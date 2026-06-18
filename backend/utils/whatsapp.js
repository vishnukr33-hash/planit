const axios = require('axios');

const API_KEY = process.env.GUPSHUP_API_KEY || process.env.WHATSAPP_API_KEY || 'sk_9548d4db0d704872bee3367ac0dd0399';
const APP_NAME = process.env.GUPSHUP_APP_NAME || 'uOBdsaJk3dKqAfj9qIeMk9ms';
const BASE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

async function sendGupshupTemplate(phone, templateId, params = []) {
  if (!phone) return;
  const normalized = phone.replace(/[\s\-\+]/g, '');
  if (normalized.length < 10) return;

  const payload = new URLSearchParams({
    source: '917305045046',
    destination: normalized,
    template: JSON.stringify({ id: templateId, params: params }),
  });

  console.log('[WhatsApp] Sending template', templateId, 'to', normalized);

  try {
    const res = await axios.post(BASE_URL, payload.toString(), {
      headers: { apikey: API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    console.log('[WhatsApp] OK:', res.data);
    return res.data;
  } catch (err) {
    console.error('[WhatsApp] FAILED to', normalized, ':', err.response?.data || err.message);
  }
}

async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';
  return sendGupshupTemplate(user.phone, '28160587806875627', [user.name, task.title, task.priority, dueStr, assignedByName]);
}

async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
  return sendGupshupTemplate(user.phone, '1057554603269663', [user.name, task.title, dueStr, task.status, task.priority]);
}

async function notifyTaskLate(user, task) {
  const dueTime = task.dueDate ? new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  return sendGupshupTemplate(user.phone, '2056861468282029', [user.name, task.title, dueTime, task.status, task.priority]);
}

async function notifyReminder(user, task, type) {
  if (type === 'due tomorrow') return notifyTaskPending(user, task);
  if (type && type.includes('hour')) return notifyTaskLate(user, task);
  return notifyTaskPending(user, task);
}

async function notifyStatusUpdate(user, task, updatedByName) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN') : 'N/A';
  return sendGupshupTemplate(user.phone, '28160587806875627', [user.name, task.title + ' [' + task.status + ']', task.priority, dueStr, updatedByName]);
}

async function testWhatsApp(phone) {
  return sendGupshupTemplate(phone, '28160587806875627', ['Test', 'Test Task', 'High', new Date().toLocaleString('en-IN'), 'Admin']);
}

module.exports = { sendGupshupTemplate, notifyTaskAssigned, notifyTaskPending, notifyTaskLate, notifyReminder, notifyStatusUpdate, testWhatsApp };
