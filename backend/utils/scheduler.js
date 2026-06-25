const cron = require('node-cron');
const Task = require('../models/Task');
const { sendEmail } = require('./email');
const { notifyTaskPending, notifyTaskLate } = require('./whatsapp');

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
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

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
            <p>Please update the status in Planit.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Planit</a></p>`
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find all overdue tasks (due date in the past, not done)
    const tasks = await Task.find({
      dueDate: { $lt: now },
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
            <p>Please complete it or update the status in Planit immediately.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Planit</a></p>`
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
            <p>Please complete it or update the status in Planit immediately.</p>
            <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Planit</a></p>`
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
