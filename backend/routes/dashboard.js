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

    // Productivity KPI: role-based personal productivity
    // Head: own tasks (self-assigned)
    // TeamLead: tasks assigned to them by Head
    // User: tasks assigned to them by TeamLead
    let productivityBaseQuery = { isDeleted: { $ne: true }, assignedTo: req.user._id };
    if (req.user.role === 'head') {
      // Head productivity = self-assigned tasks only
      productivityBaseQuery.assignedBy = req.user._id;
    } else if (req.user.role === 'teamlead') {
      // TeamLead productivity = tasks assigned by Head (their parent)
      if (req.user.parentId) {
        productivityBaseQuery.assignedBy = req.user.parentId;
      }
    } else if (req.user.role === 'user') {
      // User productivity = tasks assigned by TeamLead (their parent)
      if (req.user.parentId) {
        productivityBaseQuery.assignedBy = req.user.parentId;
      }
    }

    const [prodTotal, prodCompleted] = await Promise.all([
      Task.countDocuments(productivityBaseQuery),
      Task.countDocuments({ ...productivityBaseQuery, status: 'Done' }),
    ]);
    const personalProductivity = prodTotal > 0 ? Math.round((prodCompleted / prodTotal) * 100) : 0;

    // Single aggregation to get all KPI counts at once (faster than 10 separate queries)
    const kpiAgg = await Task.aggregate([
      { $match: baseQuery },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        needDiscussion: { $sum: { $cond: [{ $eq: ['$status', 'Need Discussion'] }, 1, 0] } },
        delayed: { $sum: { $cond: [{ $eq: ['$status', 'Delayed'] }, 1, 0] } },
        open: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'In Progress', 'Need Discussion', 'Delayed']] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', today] }, { $ne: ['$status', 'Done'] }] }, 1, 0] } },
        dueToday: { $sum: { $cond: [{ $and: [{ $gte: ['$dueDate', today] }, { $lt: ['$dueDate', tomorrow] }, { $ne: ['$status', 'Done'] }] }, 1, 0] } },
      }}
    ]);
    const kpi = kpiAgg[0] || {};
    const total = kpi.total || 0;
    const open = kpi.open || 0;
    const pending = kpi.pending || 0;
    const completed = kpi.completed || 0;
    const overdue = kpi.overdue || 0;
    const dueToday = kpi.dueToday || 0;
    const inProgress = kpi.inProgress || 0;
    const needDiscussion = kpi.needDiscussion || 0;
    const delayed = kpi.delayed || 0;
    const totalUsers = (req.user.role === 'admin' || req.user.role === 'head')
      ? await User.countDocuments({ role: { $nin: ['admin', 'head'] }, status: 'active' })
      : 0;

    const productivity = personalProductivity;

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
      }

      userProductivity = await Task.aggregate([
        { $match: productivityQuery },
        { $match: req.user.role !== 'admin' ? { $expr: { $ne: ['$assignedTo', '$assignedBy'] } } : {} },
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
      { $match: req.user.role !== 'admin' ? { $expr: { $ne: ['$assignedTo', '$assignedBy'] } } : {} },
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
