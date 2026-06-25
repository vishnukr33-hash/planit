const router = require('express').Router();
const Task = require('../models/Task');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Helper: get all subordinate user IDs recursively
async function getSubordinateIds(userId) {
  const directChildren = await User.find({ parentId: userId }).select('_id');
  let ids = directChildren.map(u => u._id);
  for (const child of directChildren) {
    const grandChildren = await getSubordinateIds(child._id);
    ids = ids.concat(grandChildren);
  }
  return ids;
}

router.get('/stats', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseQuery = { isDeleted: { $ne: true } };

    if (req.user.role === 'admin') {
      // Admin sees all tasks
    } else if (req.user.role === 'head' || req.user.role === 'teamlead') {
      // Head/TeamLead sees their own tasks + tasks they assigned
      baseQuery.$or = [
        { assignedTo: req.user._id },
        { assignedBy: req.user._id }
      ];
    } else {
      baseQuery.assignedTo = req.user._id;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) baseQuery.createdAt.$gte = new Date(startDate);
      if (endDate) baseQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const openTaskStatuses = ['Pending', 'In Progress', 'Need Discussion', 'Delayed'];

    const [total, open, pending, completed, overdue, dueToday, inProgress, needDiscussion, delayed, totalUsers] = await Promise.all([
      Task.countDocuments(baseQuery),
      Task.countDocuments({ ...baseQuery, status: { $in: openTaskStatuses } }),
      Task.countDocuments({ ...baseQuery, status: 'Pending' }),
      Task.countDocuments({ ...baseQuery, status: 'Done' }),
      Task.countDocuments({ ...baseQuery, dueDate: { $lt: today }, status: { $nin: ['Done'] } }),
      Task.countDocuments({ ...baseQuery, dueDate: { $gte: today, $lt: tomorrow }, status: { $ne: 'Done' } }),
      Task.countDocuments({ ...baseQuery, status: 'In Progress' }),
      Task.countDocuments({ ...baseQuery, status: 'Need Discussion' }),
      Task.countDocuments({ ...baseQuery, status: 'Delayed' }),
      req.user.role === 'admin' ? User.countDocuments({ role: 'user', status: 'active' }) : 0
    ]);

    const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Category distribution
    const categoryStats = await Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Status distribution
    const statusStats = await Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Completion trend — use date range or last 7 days
    let trendStartDate;
    if (startDate) {
      trendStartDate = new Date(startDate);
    } else {
      trendStartDate = new Date(today);
      trendStartDate.setDate(trendStartDate.getDate() - 6);
    }
    const completionTrend = await Task.aggregate([
      { $match: { ...baseQuery, completedAt: { $gte: trendStartDate }, status: 'Done' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // User productivity (admin and head/teamlead)
    let userProductivity = [];
    if (req.user.role === 'admin' || req.user.role === 'head' || req.user.role === 'teamlead') {
      const productivityQuery = { isDeleted: { $ne: true } };
      if (req.user.role !== 'admin') {
        // Show productivity for tasks assigned by this user to others
        productivityQuery.assignedBy = req.user._id;
        productivityQuery.isTeamTask = true;
      }
      if (startDate || endDate) {
        productivityQuery.createdAt = {};
        if (startDate) productivityQuery.createdAt.$gte = new Date(startDate);
        if (endDate) productivityQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      userProductivity = await Task.aggregate([
        { $match: productivityQuery },
        { $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Need Discussion', 'Delayed']] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', today] }, { $ne: ['$status', 'Done'] }] }, 1, 0] } },
        }},
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: {
          name: '$user.name',
          employeeCode: '$user.employeeCode',
          role: '$user.role',
          total: 1,
          done: 1,
          inProgress: 1,
          pending: 1,
          overdue: 1,
          productivity: { $multiply: [{ $divide: ['$done', { $max: ['$total', 1] }] }, 100] }
        }},
        { $sort: { productivity: -1 } },
        { $limit: 20 }
      ]);
    }

    res.json({
      kpis: { total, open, pending, completed, overdue, dueToday, inProgress, needDiscussion, delayed, productivity, totalUsers },
      categoryStats,
      statusStats,
      completionTrend,
      userProductivity
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Team productivity endpoint (for Team Tasks page)
router.get('/team-productivity', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (req.user.role === 'user') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const productivityQuery = { isDeleted: { $ne: true } };
    if (req.user.role !== 'admin') {
      productivityQuery.assignedBy = req.user._id;
      productivityQuery.isTeamTask = true;
    } else {
      productivityQuery.isTeamTask = true;
    }

    // Date range filter
    if (startDate || endDate) {
      productivityQuery.createdAt = {};
      if (startDate) productivityQuery.createdAt.$gte = new Date(startDate);
      if (endDate) productivityQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const userProductivity = await Task.aggregate([
      { $match: productivityQuery },
      { $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Need Discussion', 'Delayed']] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', today] }, { $ne: ['$status', 'Done'] }] }, 1, 0] } },
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: {
        name: '$user.name',
        employeeCode: '$user.employeeCode',
        role: '$user.role',
        total: 1,
        done: 1,
        inProgress: 1,
        pending: 1,
        overdue: 1,
        productivity: { $multiply: [{ $divide: ['$done', { $max: ['$total', 1] }] }, 100] }
      }},
      { $sort: { productivity: -1 } }
    ]);

    res.json({ userProductivity });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
