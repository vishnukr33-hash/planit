const router = require('express').Router();
const Task = require('../models/Task');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.get('/stats', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseQuery = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };

// Open tasks = not Done (Pending + Accepted + In Progress + Need Discussion + Delayed)
const openTaskStatuses = ['Pending', 'Accepted', 'In Progress', 'Need Discussion', 'Delayed']

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

    // Last 7 days completion trend
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const completionTrend = await Task.aggregate([
      { $match: { ...baseQuery, completedAt: { $gte: sevenDaysAgo }, status: 'Done' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // User productivity (admin only)
    let userProductivity = [];
    if (req.user.role === 'admin') {
      userProductivity = await Task.aggregate([
        { $group: { _id: '$assignedTo', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', total: 1, done: 1, productivity: { $multiply: [{ $divide: ['$done', '$total'] }, 100] } } },
        { $sort: { productivity: -1 } },
        { $limit: 10 }
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

module.exports = router;
