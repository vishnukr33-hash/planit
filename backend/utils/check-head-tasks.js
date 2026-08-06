require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const { notifyMyTaskReminder, notifyTeamTaskReminder } = require('./whatsapp');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  const head = await User.findOne({ phone: '918111889631' });
  if (!head) { console.log('User not found!'); process.exit(1); }
  console.log('Head:', head.name, '| ID:', head._id.toString(), '| Phone:', head.phone);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // Check tasks assigned TO head
  const myTasks = await Task.find({
    assignedTo: head._id,
    isDeleted: { $ne: true },
    status: { $nin: ['Done'] }
  }).select('title dueDate status assignedBy');

  console.log('\nTasks assigned TO head:', myTasks.length);
  myTasks.forEach(t => console.log(' -', t.title, '| Due:', t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date', '| Status:', t.status));

  // Check due today
  const dueToday = myTasks.filter(t => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd);
  const overdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < todayStart);
  console.log('\nDue Today:', dueToday.length, '| Overdue:', overdue.length);

  // Check tasks assigned BY head to others
  const teamTasks = await Task.find({
    assignedBy: head._id,
    assignedTo: { $ne: head._id },
    isDeleted: { $ne: true },
    status: { $nin: ['Done'] }
  }).populate('assignedTo', 'name').select('title dueDate status assignedTo');

  console.log('\nTasks assigned BY head to others:', teamTasks.length);
  const teamDueToday = teamTasks.filter(t => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd);
  const teamOverdue = teamTasks.filter(t => t.dueDate && new Date(t.dueDate) < todayStart);
  console.log('Team Due Today:', teamDueToday.length, '| Team Overdue:', teamOverdue.length);

  // Force send both templates
  console.log('\n--- Sending my_task_reminder (even if 0) ---');
  const r1 = await notifyMyTaskReminder(head, dueToday, overdue).catch(e => ({ error: e.message }));
  console.log('Result:', JSON.stringify(r1));

  console.log('\n--- Sending team_task_reminder ---');
  if (teamDueToday.length > 0 || teamOverdue.length > 0) {
    const r2 = await notifyTeamTaskReminder(head, teamDueToday, teamOverdue).catch(e => ({ error: e.message }));
    console.log('Result:', JSON.stringify(r2));
  } else {
    console.log('SKIP - no team tasks due/overdue');
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
