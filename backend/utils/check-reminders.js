/**
 * Test script: check users, phones, and manually trigger reminders
 * Run: node utils/check-reminders.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const { notifyMyTaskReminder, notifyTeamTaskReminder } = require('./whatsapp');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // Show all users with phones
  const users = await User.find({ status: 'active' }).select('name role phone');
  console.log('=== USERS ===');
  users.forEach(u => console.log(`${u.role.padEnd(10)} | ${(u.phone || 'NO PHONE').padEnd(15)} | ${u.name}`));

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  console.log('\n=== TESTING my_task_reminder ===');
  for (const user of users) {
    if (!user.phone) { console.log(`SKIP ${user.name} - no phone`); continue; }

    const [dueTodayTasks, overdueTasks] = await Promise.all([
      Task.find({ assignedTo: user._id, dueDate: { $gte: todayStart, $lte: todayEnd }, status: { $nin: ['Done'] }, isDeleted: { $ne: true } }).select('title').lean(),
      Task.find({ assignedTo: user._id, dueDate: { $lt: todayStart }, status: { $nin: ['Done'] }, isDeleted: { $ne: true } }).select('title').lean(),
    ]);

    console.log(`${user.name} | Due Today: ${dueTodayTasks.length} | Overdue: ${overdueTasks.length}`);

    if (dueTodayTasks.length > 0 || overdueTasks.length > 0) {
      const result = await notifyMyTaskReminder(user, dueTodayTasks, overdueTasks).catch(e => ({ error: e.message }));
      console.log(`  → Sent:`, JSON.stringify(result));
    }
  }

  console.log('\n=== TESTING team_task_reminder ===');
  const managers = await User.find({ role: { $in: ['head', 'teamlead'] }, status: 'active', phone: { $ne: '' } });
  for (const manager of managers) {
    const subordinates = await User.find({ parentId: manager._id, status: 'active' }).select('_id');
    const subIds = subordinates.map(s => s._id);
    console.log(`${manager.name} (${manager.role}) | Subordinates: ${subIds.length}`);

    if (subIds.length === 0) { console.log('  → SKIP - no subordinates'); continue; }

    const [dueTodayTasks, overdueTasks] = await Promise.all([
      Task.find({ assignedTo: { $in: subIds }, dueDate: { $gte: todayStart, $lte: todayEnd }, status: { $nin: ['Done'] }, isDeleted: { $ne: true } }).populate('assignedTo', 'name').lean(),
      Task.find({ assignedTo: { $in: subIds }, dueDate: { $lt: todayStart }, status: { $nin: ['Done'] }, isDeleted: { $ne: true } }).populate('assignedTo', 'name').lean(),
    ]);

    console.log(`  Due Today: ${dueTodayTasks.length} | Overdue: ${overdueTasks.length}`);
    const result = await notifyTeamTaskReminder(manager, dueTodayTasks, overdueTasks).catch(e => ({ error: e.message }));
    console.log(`  → Sent:`, JSON.stringify(result));
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
