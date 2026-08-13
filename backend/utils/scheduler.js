const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const { sendEmail } = require('./email');
const { notifyTaskPending, notifyTaskLate, notifyMyTaskReminder, notifyTeamTaskReminder } = require('./whatsapp');

// Keep Atlas alive - ping every 4 minutes
cron.schedule('*/4 * * * *', async () => {
  try { await Task.findOne().select('_id').lean(); } catch (_) {}
});

/**
 * TRIGGER 2: N-1 Day reminder at 9:00 AM IST
 * Sends WhatsApp (task_pending template) + Email for tasks due TOMORROW
 */
cron.schedule('30 3 * * *', async () => {
  // 3:30 UTC = 9:00 AM IST
  try {
    const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const tomorrow = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const dayAfter = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + 2, 0, 0, 0) - (5.5 * 60 * 60 * 1000));

    const tasks = await Task.find({
      dueDate: { $gte: tomorrow, $lt: dayAfter },
      status: { $nin: ['Done'] },
      isDeleted: { $ne: true },
    }).populate('assignedTo', 'name email phone');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const dueStr = new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      // WhatsApp — task_pending template
      if (task.assignedTo.phone) {
        await notifyTaskPending(task.assignedTo, task).catch(() => {});
      }

      // Email
      if (task.assignedTo.email) {
        await sendEmail({
          to: task.assignedTo.email,
          subject: `Reminder: Task "${task.title}" is due tomorrow`,
          html: `<p>Hi ${task.assignedTo.name},</p>
            <p>This is a reminder that your task <strong>${task.title}</strong> is due tomorrow.</p>
            <p><strong>Due:</strong> ${dueStr}</p>
            <p><strong>Status:</strong> ${task.status}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p>Please update the status in TVS DOT.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open TVS DOT</a></p>`
        }).catch(() => {});
      }
    }
    console.log(`[Scheduler] N-1 Day: Sent ${tasks.length} reminders`);
  } catch (err) {
    console.error('Scheduler error (N-1 day):', err);
  }
});

/**
 * TRIGGER 3: After Due Date and Time — Every Day 9:00 AM IST
 * Sends WhatsApp (task_late template) + Email for ALL overdue tasks daily
 * This runs every day at 9 AM and notifies users about tasks that are past their due date
 */
cron.schedule('30 3 * * *', async () => {
  // 3:30 UTC = 9:00 AM IST (runs alongside N-1 day but different query)
  try {
    const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStartIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0) - (5.5 * 60 * 60 * 1000));

    // Find all overdue tasks (due date in the past, not done)
    const tasks = await Task.find({
      dueDate: { $lt: todayStartIST },
      status: { $nin: ['Done'] },
      isDeleted: { $ne: true },
    }).populate('assignedTo', 'name email phone');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const dueStr = new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      // WhatsApp — task_late template
      if (task.assignedTo.phone) {
        await notifyTaskLate(task.assignedTo, task).catch(() => {});
      }

      // Email
      if (task.assignedTo.email) {
        await sendEmail({
          to: task.assignedTo.email,
          subject: `Overdue: Task "${task.title}" is past due!`,
          html: `<p>Hi ${task.assignedTo.name},</p>
            <p><strong>Your task "${task.title}" is overdue.</strong></p>
            <p><strong>Due Date:</strong> ${dueStr}</p>
            <p><strong>Status:</strong> ${task.status}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p>Please complete it or update the status in TVS DOT immediately.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open TVS DOT</a></p>`
        }).catch(() => {});
      }
    }
    if (tasks.length > 0) console.log(`[Scheduler] Overdue Daily 9AM: Sent ${tasks.length} reminders`);
  } catch (err) {
    console.error('Scheduler error (overdue daily):', err);
  }
});

/**
 * N-1 Hour reminder (1 hour before due time)
 * Runs every 5 minutes, checks for tasks due in the next 60-65 minutes
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const fiveMinBuffer = new Date(now.getTime() + 65 * 60 * 1000);

    const tasks = await Task.find({
      dueDate: { $gte: oneHourLater, $lte: fiveMinBuffer },
      status: { $nin: ['Done'] },
      isDeleted: { $ne: true },
      hourReminderSent: { $ne: true },
    }).populate('assignedTo', 'name email phone');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const dueTime = new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // WhatsApp — task_pending template (1 hour warning)
      if (task.assignedTo.phone) {
        await notifyTaskPending(task.assignedTo, task).catch(() => {});
      }

      // Email
      if (task.assignedTo.email) {
        await sendEmail({
          to: task.assignedTo.email,
          subject: `Urgent: Task "${task.title}" is due in 1 hour!`,
          html: `<p>Hi ${task.assignedTo.name},</p>
            <p><strong>Your task "${task.title}" is due in 1 hour at ${dueTime}.</strong></p>
            <p><strong>Status:</strong> ${task.status}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p>Please complete it or update the status in TVS DOT immediately.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open TVS DOT</a></p>`
        }).catch(() => {});
      }

      // Mark hour reminder sent
      task.hourReminderSent = true;
      await task.save();
    }
    if (tasks.length > 0) console.log(`[Scheduler] N-1 Hour: Sent ${tasks.length} reminders`);
  } catch (err) {
    console.error('Scheduler error (N-1 hour):', err);
  }
});

// Reset hourReminderSent daily at midnight
cron.schedule('0 0 * * *', async () => {
  await Task.updateMany({ hourReminderSent: true }, { hourReminderSent: false });
});

// Auto-purge deleted tasks older than 6 months — runs daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const result = await Task.deleteMany({ isDeleted: true, deletedAt: { $lt: sixMonthsAgo } });
    if (result.deletedCount > 0) {
      console.log(`[Scheduler] Auto-purged ${result.deletedCount} tasks from trash (older than 6 months)`);
    }
  } catch (err) {
    console.error('Scheduler error (auto-purge):', err);
  }
});

/**
 * DAILY MY TASK REMINDER — 9:00 AM IST (3:30 UTC)
 * Sends my_task_reminder WhatsApp to every active user with due-today or overdue tasks
 */
cron.schedule('30 3 * * *', async () => {
  try {
    // Use IST date (UTC+5:30) for due-today calculation
    const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const todayEnd = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59) - (5.5 * 60 * 60 * 1000));

    const users = await User.find({ status: 'active', phone: { $ne: '' } });

    let sentCount = 0;
    for (const user of users) {
      const [dueTodayTasks, overdueTasks] = await Promise.all([
        Task.find({
          assignedTo: user._id,
          dueDate: { $gte: todayStart, $lte: todayEnd },
          status: { $nin: ['Done'] },
          isDeleted: { $ne: true },
        }).select('title dueDate status priority').lean(),

        Task.find({
          assignedTo: user._id,
          dueDate: { $lt: todayStart },
          status: { $nin: ['Done'] },
          isDeleted: { $ne: true },
        }).select('title dueDate status priority').lean(),
      ]);

      if (dueTodayTasks.length === 0 && overdueTasks.length === 0) continue;

      if (user.phone) {
        await notifyMyTaskReminder(user, dueTodayTasks, overdueTasks).catch(() => {});
        sentCount++;
      }
    }
    console.log(`[Scheduler] my_task_reminder: Sent to ${sentCount} users`);
  } catch (err) {
    console.error('Scheduler error (my_task_reminder):', err);
  }
});

/**
 * DAILY TEAM TASK REMINDER — 9:00 AM IST (3:30 UTC)
 * Sends team_task_reminder WhatsApp to Head and TeamLead about their team's due/overdue tasks
 */
cron.schedule('30 3 * * *', async () => {
  try {
    // Use IST date (UTC+5:30) for due-today calculation
    const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const todayEnd = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59) - (5.5 * 60 * 60 * 1000));

    const managers = await User.find({
      role: { $in: ['head', 'teamlead'] },
      status: 'active',
      phone: { $ne: '' },
    });

    let sentCount = 0;
    for (const manager of managers) {

      let dueTodayTasks = [], overdueTasks = [];

      if (manager.role === 'head') {
        // Head sees all tasks assigned BY the head to others (not self-assigned)
        const [dt, ot] = await Promise.all([
          Task.find({
            assignedBy: manager._id,
            assignedTo: { $ne: manager._id },
            dueDate: { $gte: todayStart, $lte: todayEnd },
            status: { $nin: ['Done'] },
            isDeleted: { $ne: true },
          }).populate('assignedTo', 'name').select('title dueDate status priority assignedTo').lean(),

          Task.find({
            assignedBy: manager._id,
            assignedTo: { $ne: manager._id },
            dueDate: { $lt: todayStart },
            status: { $nin: ['Done'] },
            isDeleted: { $ne: true },
          }).populate('assignedTo', 'name').select('title dueDate status priority assignedTo').lean(),
        ]);
        dueTodayTasks = dt;
        overdueTasks = ot;

      } else if (manager.role === 'teamlead') {
        // TeamLead sees tasks assigned TO their direct subordinates (by anyone including head)
        const subordinates = await User.find({ parentId: manager._id, status: 'active' }).select('_id');
        const subIds = subordinates.map(s => s._id);
        if (subIds.length === 0) continue;

        const [dt, ot] = await Promise.all([
          Task.find({
            assignedTo: { $in: subIds },
            dueDate: { $gte: todayStart, $lte: todayEnd },
            status: { $nin: ['Done'] },
            isDeleted: { $ne: true },
          }).populate('assignedTo', 'name').select('title dueDate status priority assignedTo').lean(),

          Task.find({
            assignedTo: { $in: subIds },
            dueDate: { $lt: todayStart },
            status: { $nin: ['Done'] },
            isDeleted: { $ne: true },
          }).populate('assignedTo', 'name').select('title dueDate status priority assignedTo').lean(),
        ]);
        dueTodayTasks = dt;
        overdueTasks = ot;
      }

      if (dueTodayTasks.length === 0 && overdueTasks.length === 0) continue;

      await notifyTeamTaskReminder(manager, dueTodayTasks, overdueTasks).catch(() => {});
      sentCount++;
    }
    console.log(`[Scheduler] team_task_reminder: Sent to ${sentCount} managers`);
  } catch (err) {
    console.error('Scheduler error (team_task_reminder):', err);
  }
});

/**
 * RECURRING TASKS: Create next month's task
 */
cron.schedule('1 0 * * *', async () => {
  try {
    const now = new Date();

    // Find recurring tasks where nextOccurrence is today or in the past (need to create the next one)
    const recurringTasks = await Task.find({
      isRecurring: true,
      recurrenceActive: true,
      recurrenceType: 'monthly',
      nextOccurrence: { $lte: now },
      isDeleted: { $ne: true },
    });

    for (const task of recurringTasks) {
      try {
        // Create the new monthly occurrence
        const newDueDate = new Date(task.nextOccurrence);
        const newTask = await Task.create({
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          dueDate: newDueDate,
          assignedTo: task.assignedTo,
          assignedBy: task.assignedBy,
          isTeamTask: task.isTeamTask,
          status: task.isTeamTask ? 'In Progress' : 'Pending',
          isRecurring: true,
          recurrenceType: 'monthly',
          recurrenceActive: true,
          parentTaskId: task.parentTaskId || task._id,
          nextOccurrence: new Date(newDueDate.getFullYear(), newDueDate.getMonth() + 1, newDueDate.getDate(), newDueDate.getHours(), newDueDate.getMinutes()),
        });

        // Update the original task: move nextOccurrence forward and deactivate recurrence on this instance
        task.recurrenceActive = false;
        task.nextOccurrence = null;
        await task.save();

        console.log(`[Scheduler] Recurring: Created next occurrence of "${task.title}" due ${newDueDate.toLocaleDateString()}`);

        // Send notifications for the new task
        const populatedTask = await Task.findById(newTask._id)
          .populate('assignedTo', 'name email phone')
          .populate('assignedBy', 'name');

        if (populatedTask.assignedTo && populatedTask.assignedTo._id.toString() !== populatedTask.assignedBy?._id?.toString()) {
          if (populatedTask.assignedTo.phone) {
            notifyTaskPending(populatedTask.assignedTo, populatedTask).catch(() => {});
          }
        }
      } catch (taskErr) {
        console.error(`[Scheduler] Recurring error for task ${task._id}:`, taskErr.message);
      }
    }

    if (recurringTasks.length > 0) {
      console.log(`[Scheduler] Recurring: Processed ${recurringTasks.length} tasks`);
    }
  } catch (err) {
    console.error('Scheduler error (recurring):', err);
  }
});
