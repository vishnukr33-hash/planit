const router = require('express').Router();
const Task = require('../models/Task');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const { protect } = require('../middleware/auth');

// Admin-only reports
router.get('/user-activity', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate + 'T23:59:59.999Z');

    // Get all active users
    const users = await User.find({ status: 'active' }).select('name employeeCode role avatar');

    const report = [];

    for (const user of users) {
      // Login data
      const loginQuery = { user: user._id };
      if (startDate || endDate) loginQuery.loginAt = dateFilter;

      const loginLogs = await LoginLog.find(loginQuery);
      const totalLogins = loginLogs.length;
      const totalLoginMinutes = loginLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
      const avgLoginMinutes = totalLogins > 0 ? Math.round(totalLoginMinutes / totalLogins) : 0;

      // Task data
      const taskQuery = { assignedTo: user._id, isDeleted: { $ne: true } };
      if (startDate || endDate) taskQuery.createdAt = dateFilter;

      const [totalTasks, completedTasks] = await Promise.all([
        Task.countDocuments(taskQuery),
        Task.countDocuments({ ...taskQuery, status: 'Done' }),
      ]);

      const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Average completion time (hours from createdAt to completedAt)
      const completedTasksData = await Task.find({ ...taskQuery, status: 'Done', completedAt: { $exists: true } })
        .select('createdAt completedAt');

      let avgCompletionHours = 0;
      if (completedTasksData.length > 0) {
        const totalHours = completedTasksData.reduce((sum, t) => {
          const hours = (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgCompletionHours = Math.round((totalHours / completedTasksData.length) * 10) / 10;
      }

      // Interactions (comments/messages sent)
      const interactions = await Task.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $unwind: '$comments' },
        { $match: { 'comments.user': user._id, 'comments.type': 'comment' } },
        { $count: 'total' }
      ]);
      const totalInteractions = interactions[0]?.total || 0;

      report.push({
        _id: user._id,
        name: user.name,
        employeeCode: user.employeeCode,
        role: user.role,
        avatar: user.avatar,
        totalLogins,
        totalLoginHours: Math.round((totalLoginMinutes / 60) * 10) / 10,
        avgLoginHours: Math.round((avgLoginMinutes / 60) * 10) / 10,
        totalTasks,
        completedTasks,
        productivity,
        avgCompletionHours,
        totalInteractions,
      });
    }

    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
