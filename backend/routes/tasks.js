const router = require('express').Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { notifyTaskAssigned, notifyStatusUpdate } = require('../utils/whatsapp');
const { sendEmail } = require('../utils/email');

const User = require('../models/User');

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

// Get tasks
router.get('/', protect, async (req, res) => {
  try {
    const { status, category, priority, isTeamTask, assignedTo, search, filter, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = { isDeleted: { $ne: true } };

    if (req.user.role === 'admin') {
      if (assignedTo) query.assignedTo = assignedTo;
      if (isTeamTask !== undefined) query.isTeamTask = isTeamTask === 'true';
    } else if (req.user.role === 'head' || req.user.role === 'teamlead') {
      if (isTeamTask === 'true') {
        query.assignedBy = req.user._id;
        query.assignedTo = { $ne: req.user._id };
      } else if (assignedTo) {
        query.assignedTo = assignedTo;
      } else {
        query.assignedTo = req.user._id;
      }
    } else {
      query.assignedTo = req.user._id;
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (search) query.$or = [{ title: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];

    // Date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (filter === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.dueDate = { $lt: today };
      query.status = { $nin: ['Done'] };
    }

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username employeeCode role')
      .populate('assignedBy', 'name username role')
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
        const { isTeamTask, assignedTo, ...body } = req.body;
    const taskData = {
      ...body,
      assignedBy: req.user._id,
      assignedTo: assignedTo || req.user._id,
      isTeamTask: assignedTo && assignedTo !== req.user._id.toString()
    };

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
    const isCreator = task.assignedBy?.toString() === req.user._id.toString();
    const isAssigned = task.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned && !isCreator) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If task is locked (Done submitted), only creator/admin can edit
    if (task.lockedByDone && !isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Task is locked after Done. Only task creator can edit.' });
    }

    // Permission logic:
    // - Admin: full edit
    // - Creator (head/teamlead who assigned): full edit
    // - Assignee on self-created task: full edit
    // - Assignee on assigned task: only status
    let updateData = req.body;
    if (!isAdmin && !isCreator) {
      const isSelfAssigned = task.assignedBy?.toString() === req.user._id.toString();
      if (isSelfAssigned) {
        updateData = req.body;
      } else {
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

// Delete task — soft delete (creator or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const isCreator = task.assignedBy?.toString() === req.user._id.toString();
    if (req.user.role === 'user' && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to delete tasks' });
    }
    task.isDeleted = true;
    task.deletedAt = new Date();
    await task.save();
    res.json({ message: 'Task moved to trash' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get deleted tasks (trash)
router.get('/trash/list', protect, async (req, res) => {
  try {
    const query = { isDeleted: true };
    if (req.user.role !== 'admin') {
      query.assignedBy = req.user._id;
    }
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username employeeCode')
      .populate('assignedBy', 'name username')
      .sort({ deletedAt: -1 });
    res.json({ tasks, total: tasks.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Permanently delete task from trash
router.delete('/:id/permanent', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Restore task from trash
router.patch('/:id/restore', protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, { isDeleted: false, deletedAt: null }, { new: true });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export tasks to CSV (Excel-compatible) with date range
router.get('/export/excel', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { isDeleted: { $ne: true } };
    if (req.user.role !== 'admin') {
      query.$or = [{ assignedTo: req.user._id }, { assignedBy: req.user._id }];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name employeeCode')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    const headers = 'Title,Description,Status,Category,Priority,Due Date,Assigned To,Assigned By,Created At\n';
    const rows = tasks.map(t => {
      const due = t.dueDate ? new Date(t.dueDate).toLocaleString('en-IN') : '';
      const created = new Date(t.createdAt).toLocaleString('en-IN');
      return '"' + (t.title || '').replace(/"/g, '""') + '","' + (t.description || '').replace(/"/g, '""') + '","' + t.status + '","' + t.category + '","' + t.priority + '","' + due + '","' + (t.assignedTo?.name || '') + '","' + (t.assignedBy?.name || '') + '","' + created + '"';
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=planit-tasks.csv');
    res.send(headers + rows);
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

