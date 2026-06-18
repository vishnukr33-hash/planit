const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || 'sk_9548d4db0d704872bee3367ac0dd0399';
const BASE_URL = 'https://api.interakt.ai/v1/public/message/';

async function sendWhatsAppTemplate(phone, templateName, bodyValues = []) {
  if (!phone) return;
  const normalized = phone.replace(/[\s\-\+]/g, '');
  if (normalized.length < 10) return;

  const payload = {
    countryCode: '+91',
    phoneNumber: normalized,
    callbackData: 'planit_notification',
    type: 'Template',
    template: {
      name: templateName,
      languageCode: 'en',
      bodyValues: bodyValues.map(String),
    },
  };

  console.log('[WhatsApp] Sending', templateName, 'to', normalized, 'key:', API_KEY.substring(0,10));

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: { Authorization: 'Basic ' + API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log('[WhatsApp] OK:', res.data);
    return res.data;
  } catch (err) {
    console.error('[WhatsApp] FAILED:', err.response?.data || err.message);
  }
}

async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';
  return sendWhatsAppTemplate(user.phone, 'new_task', [user.name, task.title, task.priority, dueStr, assignedByName]);
}

async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
  return sendWhatsAppTemplate(user.phone, 'task_pending', [user.name, task.title, dueStr, task.status, task.priority]);
}

async function notifyTaskLate(user, task) {
  const dueTime = task.dueDate ? new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  return sendWhatsAppTemplate(user.phone, 'task_late', [user.name, task.title, dueTime, task.status, task.priority]);
}

async function notifyReminder(user, task, type) {
  if (type === 'due tomorrow') return notifyTaskPending(user, task);
  if (type && type.includes('hour')) return notifyTaskLate(user, task);
  return notifyTaskPending(user, task);
}

async function notifyStatusUpdate(user, task, updatedByName) {
  return sendWhatsAppTemplate(user.phone, 'new_task', [user.name, task.title + ' [' + task.status + ']', task.priority, task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN') : 'N/A', updatedByName]);
}

async function testWhatsApp(phone) {
  return sendWhatsAppTemplate(phone, 'new_task', ['Test', 'Test Task', 'High', new Date().toLocaleString('en-IN'), 'Admin']);
}

module.exports = { sendWhatsAppTemplate, notifyTaskAssigned, notifyTaskPending, notifyTaskLate, notifyReminder, notifyStatusUpdate, testWhatsApp };
