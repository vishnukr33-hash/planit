const router = require('express').Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { notifyTaskAssigned } = require('../utils/whatsapp');
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

// =============================================
// STATIC ROUTES FIRST (before /:id)
// =============================================

// Get deleted tasks (trash)
router.get('/trash/list', protect, async (req, res) => {
  try {
    const query = { isDeleted: true };
    if (req.user.role !== 'admin') {
      query.assignedBy = req.user._id;
    }
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username employeeCode avatar')
      .populate('assignedBy', 'name username avatar')
      .sort({ deletedAt: -1 });
    res.json({ tasks, total: tasks.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export tasks to CSV (Excel-compatible) with date range support
router.get('/export/excel', protect, async (req, res) => {
  try {
    const { startDate, endDate, isTeamTask } = req.query;
    const query = { isDeleted: { $ne: true } };

    if (req.user.role === 'admin') {
      if (isTeamTask === 'true') {
        query.isTeamTask = true;
      }
    } else if (req.user.role === 'head' || req.user.role === 'teamlead') {
      if (isTeamTask === 'true') {
        query.assignedBy = req.user._id;
        query.assignedTo = { $ne: req.user._id };
      } else {
        query.assignedTo = req.user._id;
      }
    } else {
      query.assignedTo = req.user._id;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name employeeCode')
      .populate('assignedBy', 'name')
      .populate('sharedWith', 'name')
      .populate('completedBy', 'name')
      .sort({ createdAt: -1 });

    // Generate CSV with Completion Date, Time, and Shared With columns
    const headers = 'Title,Description,Status,Category,Priority,Due Date,Due Time,Assigned To,Assigned By,Shared With,Created At,Completion Date,Completion Time\n';
    const rows = tasks.map(t => {
      const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '';
      const dueTime = t.dueDate ? new Date(t.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      const created = new Date(t.createdAt).toLocaleString('en-IN');
      const completionDate = t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-IN') : '';
      const completionTime = t.completedAt ? new Date(t.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      const sharedWith = t.isShared && t.sharedWith?.length ? t.sharedWith.map(u => u.name).join('; ') : '';
      return `"${(t.title || '').replace(/"/g, '""')}","${(t.description || '').replace(/"/g, '""')}","${t.status}","${t.category}","${t.priority}","${due}","${dueTime}","${t.assignedTo?.name || ''}","${t.assignedBy?.name || ''}","${sharedWith}","${created}","${completionDate}","${completionTime}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=TVS DOT-tasks.csv');
    res.send(headers + rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get tasks with chats (for Chats sidebar page)
router.get('/chats/list', protect, async (req, res) => {
  try {
    const query = { isDeleted: { $ne: true }, 'comments.0': { $exists: true } };

    if (req.user.role === 'admin') {
      // admin sees all
    } else if (req.user.role === 'head' || req.user.role === 'teamlead') {
      query.$or = [
        { assignedTo: req.user._id },
        { assignedBy: req.user._id }
      ];
    } else {
      query.assignedTo = req.user._id;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username avatar')
      .populate('assignedBy', 'name username avatar')
      .populate('comments.user', 'name username avatar')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// MAIN ROUTES
// =============================================

// Get tasks
router.get('/', protect, async (req, res) => {
  try {
    const { status, category, priority, isTeamTask, assignedTo, search, filter, page = 1, limit = 50, startDate, endDate, scope } = req.query;
    const query = { isDeleted: { $ne: true } };

    if (req.user.role === 'admin') {
      // Admin sees ALL tasks
      if (assignedTo) query.assignedTo = assignedTo;
      if (isTeamTask !== undefined) query.isTeamTask = isTeamTask === 'true';

    } else if (req.user.role === 'head') {
      if (isTeamTask === 'true') {
        // Team Tasks: tasks assigned BY head to others
        query.assignedBy = req.user._id;
        query.assignedTo = { $ne: req.user._id };
      } else if (scope === 'dashboard') {
        // Dashboard scope: self tasks + tasks assigned by head to others
        query.$or = [
          { assignedTo: req.user._id },
          { assignedBy: req.user._id, isTeamTask: true }
        ];
      } else {
        // My Tasks: ONLY self-assigned tasks (assigned to head AND by head)
        query.assignedTo = req.user._id;
        query.assignedBy = req.user._id;
      }

    } else if (req.user.role === 'teamlead') {
      if (isTeamTask === 'true') {
        // Team Tasks: tasks assigned BY teamlead to others
        query.assignedBy = req.user._id;
        query.assignedTo = { $ne: req.user._id };
      } else if (scope === 'dashboard') {
        // Dashboard scope: tasks assigned to self + tasks assigned by teamlead to others
        query.$or = [
          { assignedTo: req.user._id },
          { assignedBy: req.user._id, isTeamTask: true }
        ];
      } else {
        // My Tasks: tasks assigned TO this teamlead (by anyone)
        query.assignedTo = req.user._id;
      }

    } else {
      // User: My Tasks = tasks assigned to this user (by anyone)
      query.assignedTo = req.user._id;
    }

    if (assignedTo && !['admin'].includes(req.user.role)) {
      // explicit assignedTo override (from team tasks filter)
      if (req.user.role === 'head' || req.user.role === 'teamlead') {
        query.assignedTo = assignedTo;
        delete query.assignedBy;
        delete query.$or;
      }
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
    if (filter === 'open') {
      query.status = { $in: ['Pending', 'In Progress', 'Need Discussion', 'Delayed'] };
    }

    // Date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [total, tasks] = await Promise.all([
      Task.countDocuments(query),
      Task.find(query)
        .populate('assignedTo', 'name username employeeCode role avatar')
        .populate('assignedBy', 'name username role avatar')
        .populate('sharedWith', 'name username employeeCode avatar')
        .populate('comments.user', 'name username avatar')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ dueDate: 1, createdAt: -1 })
        .lean()
    ]);

    res.json({ tasks, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single task (MUST be after /trash/list and /export/excel)
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name username employeeCode avatar')
      .populate('assignedBy', 'name username avatar')
      .populate('sharedWith', 'name username employeeCode avatar')
      .populate('comments.user', 'name username avatar');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create task
router.post('/', protect, async (req, res) => {
  try {
    const { isTeamTask, assignedTo, isRecurring, isShared, sharedWith, ...body } = req.body;

    // SHARED TASK: create one task instance per assignee
    if (isShared && sharedWith && sharedWith.length > 0) {
      const createdTasks = [];
      const dueStr = body.dueDate ? new Date(body.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';

      for (const userId of sharedWith) {
        const taskData = {
          ...body,
          assignedBy: req.user._id,
          assignedTo: userId,
          isTeamTask: true,
          isShared: true,
          sharedWith: sharedWith,
          status: 'In Progress',
        };
        if (isRecurring) {
          taskData.isRecurring = true;
          taskData.recurrenceType = 'monthly';
          taskData.recurrenceActive = true;
          if (taskData.dueDate) {
            const nextDate = new Date(taskData.dueDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            taskData.nextOccurrence = nextDate;
          }
        }
        const task = await Task.create(taskData);
        await task.populate('assignedTo', 'name username employeeCode phone email avatar');
        await task.populate('assignedBy', 'name username avatar');
        await task.populate('sharedWith', 'name username employeeCode avatar');

        req.io?.to(task.assignedTo._id.toString()).emit('task:new', task);

        if (task.assignedTo.phone) notifyTaskAssigned(task.assignedTo, task, req.user.name).catch(() => {});
        if (task.assignedTo.email) {
          sendEmail({
            to: task.assignedTo.email,
            subject: `👥 Shared Task: "${task.title}"`,
            html: `<p>Hi ${task.assignedTo.name},</p>
              <p>A shared task has been assigned to you by <strong>${req.user.name}</strong>.</p>
              <p><strong>Task:</strong> ${task.title}</p>
              <p><strong>Priority:</strong> ${task.priority}</p>
              <p><strong>Due:</strong> ${dueStr}</p>
              <p>👥 This is a shared task.<br/><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#9333ea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open TVS DOT</a></p>`
          }).catch(() => {});
        }
        createdTasks.push(task);
      }
      return res.status(201).json(createdTasks[0]);
    }

    // REGULAR TASK
    const isAssignedToOther = assignedTo && assignedTo !== req.user._id.toString();
    const taskData = {
      ...body,
      assignedBy: req.user._id,
      assignedTo: assignedTo || req.user._id,
      isTeamTask: isAssignedToOther,
      status: isAssignedToOther ? 'In Progress' : (body.status || 'Pending'),
    };

    // Handle recurring task setup
    if (isRecurring) {
      taskData.isRecurring = true;
      taskData.recurrenceType = 'monthly';
      taskData.recurrenceActive = true;
      if (taskData.dueDate) {
        const nextDate = new Date(taskData.dueDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        taskData.nextOccurrence = nextDate;
      }
    }

    const task = await Task.create(taskData);
    await task.populate('assignedTo', 'name username employeeCode phone email avatar');
    await task.populate('assignedBy', 'name username avatar');

    req.io?.to(task.assignedTo._id.toString()).emit('task:new', task);

    if (task.assignedTo._id.toString() !== req.user._id.toString()) {
      const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';

      if (task.assignedTo.phone) {
        notifyTaskAssigned(task.assignedTo, task, req.user.name).catch(() => {});
      }

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
            ${task.isRecurring ? '<p><em>📅 This is a monthly recurring task.</em></p>' : ''}
            <p>Please login to TVS DOT to start working on it.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open TVS DOT</a></p>`
        }).catch(() => {});
      }
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update task — role-based restrictions with hierarchy support
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isAdmin = req.user.role === 'admin' || req.user.role === 'head';
    const isAssigned = task.assignedTo.toString() === req.user._id.toString();
    const isCreator = task.assignedBy?.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned && !isCreator) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (task.lockedByDone && !isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Task is locked after Done submission. Only admin/task creator can edit.' });
    }

    let updateData = req.body;

    if (isAdmin || isCreator) {
      updateData = req.body;
    } else if (isAssigned) {
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

    // Capture completion data when status changes to Done
    if (updateData.status === 'Done' && prevStatus !== 'Done') {
      updateData.completedAt = new Date();
      updateData.completedBy = req.user._id;
    }

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
      .populate('assignedTo', 'name username employeeCode phone email avatar')
      .populate('assignedBy', 'name username avatar')
      .populate('comments.user', 'name username avatar');

    req.io?.to(updated.assignedTo._id.toString()).emit('task:updated', updated);

    if (updateData.status && updateData.status !== prevStatus && updated.assignedTo.phone) {
      // WhatsApp status update notification removed
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Accept task (backward compatibility)
router.patch('/:id/accept', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.assignedTo?.toString() !== req.user._id?.toString()) {
      return res.status(403).json({ message: 'Only the assigned user can accept this task' });
    }
    if (task.status !== 'Pending') {
      return res.status(400).json({ message: `Task is already ${task.status}` });
    }

    task.status = 'In Progress';
    task.comments.push({
      user: req.user._id,
      text: 'Task accepted',
      type: 'status_update',
      statusFrom: 'Pending',
      statusTo: 'In Progress',
    });
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name username employeeCode avatar')
      .populate('assignedBy', 'name username avatar')
      .populate('comments.user', 'name username avatar');

    if (populated.assignedBy) {
      req.io?.to(populated.assignedBy._id.toString()).emit('task:updated', populated);
    }
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete task — soft delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isAdmin = req.user.role === 'admin' || req.user.role === 'head';
    const isCreator = task.assignedBy?.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator && req.user.role !== 'teamlead') {
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

// Permanently delete task from trash
router.delete('/:id/permanent', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'head') return res.status(403).json({ message: 'Admin/Head only' });
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

// Add comment
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name username phone avatar')
      .populate('assignedBy', 'name username phone avatar');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    task.comments.push({ user: req.user._id, text: req.body.text, type: 'comment' });
    await task.save();
    await task.populate('comments.user', 'name username avatar');
    req.io?.to(task.assignedTo._id.toString()).emit('task:comment', { taskId: task._id, taskTitle: task.title, comment: task.comments.at(-1) });

    // Also emit to assignedBy if different
    if (task.assignedBy && task.assignedBy._id.toString() !== task.assignedTo._id.toString()) {
      req.io?.to(task.assignedBy._id.toString()).emit('task:comment', { taskId: task._id, taskTitle: task.title, comment: task.comments.at(-1) });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle recurring status
router.patch('/:id/recurrence', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isAdmin = req.user.role === 'admin' || req.user.role === 'head';
    const isCreator = task.assignedBy?.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only task creator or admin can manage recurrence' });
    }

    const { recurrenceActive } = req.body;
    task.recurrenceActive = recurrenceActive;
    if (!recurrenceActive) {
      task.nextOccurrence = null;
    }
    await task.save();

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
    task.completedBy = req.user._id;
    if (task.isTeamTask) task.lockedByDone = true;
    await task.save();
    await task.populate('assignedTo', 'name username avatar');
    await task.populate('assignedBy', 'name username avatar');
    await task.populate('comments.user', 'name username avatar');
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
