const cron = require('node-cron');
const Task = require('../models/Task');
const { sendEmail } = require('./email');
const { notifyTaskPending, notifyTaskLate } = require('./whatsapp');

// Keep Atlas alive - ping every 4 minutes
cron.schedule('*/4 * * * *', async () => {
  try { await Task.findOne().select('_id').lean(); } catch (_) {}
});

/**
 * TRIGGER 2: N-1 Day reminder at 9:00 AM
 * Sends WhatsApp + Email for tasks due TOMORROW (1 day before due date)
 */
cron.schedule('0 9 * * *', async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tasks = await Task.find({
      dueDate: { $gte: tomorrow, $lt: dayAfter },
      status: { $nin: ['Done'] },
      isTeamTask: true,
    }).populate('assignedTo', 'name email phone');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const dueStr = new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      // WhatsApp — template: task_pending
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
 * TRIGGER 3: N-1 Hour reminder (1 hour before due time)
 * Runs every 5 minutes, checks for tasks due in the next 60-65 minutes
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const fiveMinBuffer = new Date(now.getTime() + 65 * 60 * 1000);

    // Find tasks due within the next 60-65 minutes that haven't had hour-reminder sent
    const tasks = await Task.find({
      dueDate: { $gte: oneHourLater, $lte: fiveMinBuffer },
      status: { $nin: ['Done'] },
      isTeamTask: true,
      hourReminderSent: { $ne: true },
    }).populate('assignedTo', 'name email phone');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const dueTime = new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // WhatsApp — template: task_late
      if (task.assignedTo.phone) {
        await notifyTaskLate(task.assignedTo, task).catch(() => {});
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

      // Mark hour reminder sent so we don't re-send
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
