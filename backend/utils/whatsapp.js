const axios = require('axios');

const API_KEY = process.env.GUPSHUP_API_KEY || 'sk_9548d4db0d704872bee3367ac0dd0399';
const BASE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

async function sendGupshupTemplate(phone, templateId, params) {
  if (!phone) return;
  var normalized = phone.replace(/[\s\-\+]/g, '');
  if (normalized.length < 10) return;

  var payload = 'source=917305045046&destination=' + normalized + '&template=' + encodeURIComponent(JSON.stringify({id: templateId, params: params || []}));

  console.log('[WhatsApp-Gupshup] Sending template ' + templateId + ' to ' + normalized);

  try {
    var res = await axios.post(BASE_URL, payload, {
      headers: { 'apikey': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    console.log('[WhatsApp-Gupshup] OK:', JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    console.error('[WhatsApp-Gupshup] FAILED:', JSON.stringify(err.response ? err.response.data : err.message));
  }
}

async function notifyTaskAssigned(user, task, assignedByName) {
  var dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN') : 'No due date';
  return sendGupshupTemplate(user.phone, '28160587806875627', [user.name, task.title, task.priority, dueStr, assignedByName]);
}

async function notifyTaskPending(user, task) {
  var dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN') : 'N/A';
  return sendGupshupTemplate(user.phone, '1057554603269663', [user.name, task.title, dueStr, task.status, task.priority]);
}

async function notifyTaskLate(user, task) {
  var dueTime = task.dueDate ? new Date(task.dueDate).toLocaleTimeString('en-IN') : 'N/A';
  return sendGupshupTemplate(user.phone, '2056861468282029', [user.name, task.title, dueTime, task.status, task.priority]);
}

async function notifyReminder(user, task, type) {
  if (type === 'due tomorrow') return notifyTaskPending(user, task);
  if (type && type.includes('hour')) return notifyTaskLate(user, task);
  return notifyTaskPending(user, task);
}

async function notifyStatusUpdate(user, task, updatedByName) {
  var dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN') : 'N/A';
  return sendGupshupTemplate(user.phone, '28160587806875627', [user.name, task.title + ' [' + task.status + ']', task.priority, dueStr, updatedByName]);
}

async function testWhatsApp(phone) {
  return sendGupshupTemplate(phone, '28160587806875627', ['Test', 'Test Task', 'High', new Date().toLocaleString('en-IN'), 'Admin']);
}

module.exports = { sendGupshupTemplate: sendGupshupTemplate, notifyTaskAssigned: notifyTaskAssigned, notifyTaskPending: notifyTaskPending, notifyTaskLate: notifyTaskLate, notifyReminder: notifyReminder, notifyStatusUpdate: notifyStatusUpdate, testWhatsApp: testWhatsApp };
