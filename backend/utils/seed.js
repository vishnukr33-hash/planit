/**
 * Run: node utils/seed.js
 * Seeds admin user and sample data
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/todo_portal');
  console.log('Connected');

  await User.deleteMany({});
  await Task.deleteMany({});

  const admin = await User.create({
    employeeCode: 'ADM001',
    name: 'Admin',
    email: 'admin@company.com',
    username: 'admin',
    password: 'Admin@2026',
    role: 'admin',
    status: 'active'
  });

  const users = await User.insertMany([
    { employeeCode: '28708', name: 'Vishnu K R', email: 'vishnu@company.com', username: 'VishnuRavi', password: 'Years@2027', role: 'user', status: 'active' },
    { employeeCode: '36368', name: 'Kishore', email: 'kishore@company.com', username: 'Kishore', password: 'Year@2026', role: 'user', status: 'active' },
    { employeeCode: '66512', name: 'Sachin', email: 'sachin@company.com', username: 'Sachin', password: 'Year@2006', role: 'user', status: 'inactive' },
    { employeeCode: 'U004', name: 'Abhi', email: 'abhi@company.com', username: 'Abhi', password: 'Pass@2026', role: 'user', status: 'active' },
    { employeeCode: 'U005', name: 'Arun', email: 'arun@company.com', username: 'Arun', password: 'Pass@2026', role: 'user', status: 'active' },
  ]);

  await Task.insertMany([
    { title: 'AL GMB', description: 'Create AL GMB for 57 Outlets', status: 'In Progress', category: 'Website Update', priority: 'High', dueDate: new Date('2026-04-17'), assignedTo: users[0]._id, assignedBy: admin._id, isTeamTask: true },
    { title: 'Intown & Innoblitz agreement', description: 'Legal Agreement', status: 'Done', category: 'Legal', priority: 'High', dueDate: new Date('2026-04-11'), assignedTo: users[0]._id, assignedBy: admin._id, isTeamTask: true },
    { title: 'TVSONE RO Uploading', description: 'TVSONE PMS RO Uploading', status: 'Need Discussion', category: 'Operations', priority: 'Medium', dueDate: new Date('2026-04-20'), assignedTo: users[1]._id, assignedBy: admin._id, isTeamTask: true },
    { title: 'ZUDU AI', description: 'ZUDU AI Implementing in AL', status: 'Pending', category: 'AI', priority: 'Critical', dueDate: new Date('2026-04-17'), assignedTo: users[2]._id, assignedBy: admin._id, isTeamTask: true },
    { title: 'Admin Self Task', description: 'Review monthly reports', status: 'Pending', category: 'Operations', priority: 'Medium', dueDate: new Date('2026-05-15'), assignedTo: admin._id, assignedBy: admin._id, isTeamTask: false },
  ]);

  console.log('Seeded successfully');
  console.log('Admin login: username=admin, password=Admin@2026');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
