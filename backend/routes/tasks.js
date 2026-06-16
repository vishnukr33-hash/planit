const router = require('express').Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { notifyTaskAssigned, notifyStatusUpdate } = require('../utils/whatsapp');
const { sendEmail } = require('../utils/email');

// Get tasks
router.get('/', protect, async (req, res) => {
  try {
    const { status, category, priority, isTeamTask, assignedTo, search, filter, page = 1, limit = 50 } = req.query;
    const query = {};

    if (req.user.role === 'admin') {
      if (assignedTo) query.assignedTo = assignedTo;
      if (isTeamTask !== undefined) query.isTeamTask = isTeamTask === 'true';
    } else {
      query.assignedTo = req.user._id;
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (search) query.$or = [{ title: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];

    if (filter === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.dueDate = { $lt: today };
      query.status = { $nin: ['Done'] };
    }

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username employeeCode')
      .populate('assignedBy', 'name username')
      .populate('comments.user', 'name username')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ dueDate: 1, createdAt: -1 });

    res.json({ tasks, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single task
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name username employeeCode')
      .populate('assignedBy', 'name username')
      .populate('comments.user', 'name username');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create task
router.post('/', protect, async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      assignedBy: req.user._id,
      isTeamTask: req.user.role === 'admin' && req.body.assignedTo && req.body.assignedTo !== req.user._id.toString()
    };
    if (!taskData.assignedTo) taskData.assignedTo = req.user._id;

    const task = await Task.create(taskData);
    await task.populate('assignedTo', 'name username employeeCode phone email');
    await task.populate('assignedBy', 'name username');

    req.io?.to(task.assignedTo._id.toString()).emit('task:new', task);

    // Send WhatsApp + Email notification on assignment (only if assigned to someone else)
    if (task.assignedTo._id.toString() !== req.user._id.toString()) {
      const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date'

      // WhatsApp
      if (task.assignedTo.phone) {
        notifyTaskAssigned(task.assignedTo, task, req.user.name).catch(() => {});
      }

      // Email
      if (task.assignedTo.email) {
        sendEmail({
          to: task.assignedTo.email,
          subject: `New Task Assigned: "${task.title}"`,
          html: `<p>Hi ${task.assignedTo.name},</p>
            <p>A new task has been assigned to you by <strong>${req.user.name}</strong>.</p>
            <p><strong>Task:</strong> ${task.title}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p><strong>Due:</strong> ${dueStr}</p>
            <p><strong>Description:</strong> ${task.description || 'N/A'}</p>
            <p>Please login to Planit to accept and start working on it.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Planit</a></p>`
        }).catch(() => {});
      }
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update task — role-based restrictions
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isAdmin = req.user.role === 'admin';
    const isAssigned = task.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If task is locked (team member submitted Done), only admin can edit
    if (task.lockedByDone && !isAdmin) {
      return res.status(403).json({ message: 'Task is locked after Done submission. Only admin can edit.' });
    }

    // Team members: if self-assigned task, allow all fields; if admin-assigned, only status
    let updateData = req.body;
    if (!isAdmin) {
      const isSelfAssigned = task.assignedBy?.toString() === req.user._id.toString();
      if (isSelfAssigned) {
        // self-assigned: allow full edit (but not lockedByDone tasks)
        updateData = req.body;
      } else {
        // admin-assigned: only allow status update
        const { status } = req.body;
        updateData = {};
        if (status) updateData.status = status;
      }
    }

    const prevStatus = task.status;

    // Track status change as a chat entry
    if (updateData.status && updateData.status !== prevStatus) {
      await Task.findByIdAndUpdate(req.params.id, {
        $push: {
          comments: {
            user: req.user._id,
            text: `Status changed from "${prevStatus}" to "${updateData.status}"`,
            type: 'status_update',
            statusFrom: prevStatus,
            statusTo: updateData.status,
          }
        }
      });
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate('assignedTo', 'name username employeeCode phone email')
      .populate('assignedBy', 'name username')
      .populate('comments.user', 'name username');

    req.io?.to(updated.assignedTo._id.toString()).emit('task:updated', updated);

    if (updateData.status && updateData.status !== prevStatus && updated.assignedTo.phone) {
      notifyStatusUpdate(updated.assignedTo, updated, req.user.name).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Accept task (team member) — sets status to Accepted
router.patch('/:id/accept', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const assignedToId = task.assignedTo?.toString();
    const currentUserId = req.user._id?.toString();

    if (assignedToId !== currentUserId) {
      return res.status(403).json({ message: 'Only the assigned user can accept this task' });
    }
    if (task.status !== 'Pending') {
      return res.status(400).json({ message: `Task is already ${task.status}` });
    }

    task.status = 'Accepted';
    task.comments.push({
      user: req.user._id,
      text: 'Task accepted',
      type: 'status_update',
      statusFrom: 'Pending',
      statusTo: 'Accepted',
    });
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name username employeeCode')
      .populate('assignedBy', 'name username')
      .populate('comments.user', 'name username');

    // Notify admin via socket
    if (populated.assignedBy) {
      req.io?.to(populated.assignedBy._id.toString()).emit('task:updated', populated);
    }
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete task — admin only
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete tasks' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add comment (chat message)
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    task.comments.push({ user: req.user._id, text: req.body.text, type: 'comment' });
    await task.save();
    await task.populate('comments.user', 'name username');
    req.io?.to(task.assignedTo.toString()).emit('task:comment', { taskId: task._id, comment: task.comments.at(-1) });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark complete
router.patch('/:id/complete', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.comments.push({
      user: req.user._id,
      text: `Task marked as Done`,
      type: 'status_update',
      statusFrom: task.status,
      statusTo: 'Done',
    });
    task.status = 'Done';
    task.completedAt = new Date();
    if (task.isTeamTask) task.lockedByDone = true;
    await task.save();
    await task.populate('assignedTo', 'name username');
    await task.populate('assignedBy', 'name username');
    await task.populate('comments.user', 'name username');
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
