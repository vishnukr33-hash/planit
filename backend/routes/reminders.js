const router = require('express').Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// Get consolidated reminders
router.get('/', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const baseQuery = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };

    const [dueToday, overdue, upcoming, recentComments] = await Promise.all([
      Task.find({ ...baseQuery, dueDate: { $gte: today, $lt: tomorrow }, status: { $ne: 'Done' } })
        .populate('assignedTo', 'name username').populate('assignedBy', 'name username'),
      Task.find({ ...baseQuery, dueDate: { $lt: today }, status: { $nin: ['Done'] } })
        .populate('assignedTo', 'name username').populate('assignedBy', 'name username'),
      Task.find({ ...baseQuery, dueDate: { $gte: tomorrow, $lte: nextWeek }, status: { $ne: 'Done' } })
        .populate('assignedTo', 'name username').populate('assignedBy', 'name username'),
      Task.find({ ...baseQuery, 'comments.0': { $exists: true } })
        .populate('assignedTo', 'name username')
        .populate('comments.user', 'name username')
        .sort({ updatedAt: -1 }).limit(10)
    ]);

    res.json({ dueToday, overdue, upcoming, recentComments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
