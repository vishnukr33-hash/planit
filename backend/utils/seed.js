/**
 * Run: node utils/seed.js
 * Seeds users with hierarchy: Admin → Head → Team Lead → Users
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

  // Admin
  const admin = await User.create({
    employeeCode: 'ADM001', name: 'Admin', email: 'admin@company.com',
    username: 'admin', password: 'Admin@2026', role: 'admin', status: 'active'
  });

  // Head (reports to admin)
  const head = await User.create({
    employeeCode: '28708', name: 'Vishnu K R', email: 'vishnu@company.com',
    username: 'VishnuRavi', password: 'Years@2027', role: 'head', parentId: admin._id, status: 'active'
  });

  // Team Leads (report to head)
  const tl1 = await User.create({
    employeeCode: '36368', name: 'Kishore', email: 'kishore@company.com',
    username: 'Kishore', password: 'Year@2026', role: 'teamlead', parentId: head._id, status: 'active'
  });
  const tl2 = await User.create({
    employeeCode: '66512', name: 'Sachin', email: 'sachin@company.com',
    username: 'Sachin', password: 'Year@2006', role: 'teamlead', parentId: head._id, status: 'active'
  });

  // Users (report to team leads)
  await User.create({
    employeeCode: 'U004', name: 'Abhi', email: 'abhi@company.com',
    username: 'Abhi', password: 'Pass@2026', role: 'user', parentId: tl1._id, status: 'active'
  });
  await User.create({
    employeeCode: 'U005', name: 'Arun', email: 'arun@company.com',
    username: 'Arun', password: 'Pass@2026', role: 'user', parentId: tl1._id, status: 'active'
  });
  await User.create({
    employeeCode: 'U006', name: 'Deepa', email: 'deepa@company.com',
    username: 'Deepa', password: 'Pass@2026', role: 'user', parentId: tl2._id, status: 'active'
  });

  console.log('Seeded hierarchy: Admin → Head → Team Leads → Users');
  console.log('Admin login: admin / Admin@2026');
  console.log('Head login: VishnuRavi / Years@2027');
  console.log('Team Lead login: Kishore / Year@2026');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
