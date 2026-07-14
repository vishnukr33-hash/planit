const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || '';
const APP_NAME = process.env.WHATSAPP_APP_NAME || '';
const SOURCE_NUMBER = '917305045046';
const TEMPLATE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

// Gupshup Template IDs (use Gupshup template ID, NOT Facebook template ID)
const TEMPLATE_NEW_TASK = process.env.WHATSAPP_TEMPLATE_NEW_TASK || 'e4fe8bc8-bb0a-4cfe-8f4c-de7136339a9c';
const TEMPLATE_TASK_PENDING = process.env.WHATSAPP_TEMPLATE_TASK_PENDING || '58ddef52-ed02-4d65-9be1-5845e93ca1';
const TEMPLATE_TASK_LATE = process.env.WHATSAPP_TEMPLATE_TASK_LATE || 'b8e43c52-e05a-4f83-b782-6953326e59de';

function normalizePhone(phone) {
  if (!phone) return null;
  let normalized = String(phone).replace(/[\s\-\+]/g, '');
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }
  return normalized;
}

// Send template message via Gupshup
async function sendGupshupTemplate(phone, templateId, params) {
  const normalized = normalizePhone(phone);
  if (!normalized || !API_KEY) {
    console.log('[WhatsApp] Skipped - no phone or API key');
    return;
  }

  console.log('[WhatsApp] Template to:', normalized, 'Template:', templateId, 'App:', APP_NAME);

  const payload = new URLSearchParams({
    channel: 'whatsapp',
    source: SOURCE_NUMBER,
    destination: normalized,
    'src.name': APP_NAME,
    template: JSON.stringify({ id: templateId, params: params || [] }),
  }).toString();

  try {
    const res = await axios.post(TEMPLATE_URL, payload, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': API_KEY,
      },
      timeout: 10000
    });
    console.log('[WhatsApp] Template sent:', JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    console.error('[WhatsApp] Template error:', JSON.stringify(err.response?.data || err.message));
  }
}

// === NOTIFICATION FUNCTIONS ===

// new_task template has 1 param: task title or message
async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No due date';
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    `${task.title} | Due: ${dueStr} | Priority: ${task.priority} | By: ${assignedByName}`
  ]);
}

// task_pending template has 1 param: reminder message
async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';
  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_PENDING, [
    `${task.title} | Due: ${dueStr} | Status: ${task.status}`
  ]);
}

// task_late template has 1 param: overdue message
async function notifyTaskLate(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';
  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_LATE, [
    `${task.title} | Was Due: ${dueStr} | Status: ${task.status}`
  ]);
}

async function notifyReminder(user, task, type) {
  if (type === 'due tomorrow') {
    return notifyTaskPending(user, task);
  }
  if (type && type.includes('hour')) {
    return notifyTaskLate(user, task);
  }
  return notifyTaskPending(user, task);
}

async function notifyStatusUpdate(user, task, updatedByName) {
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    `${task.title} | Status: ${task.status} | Updated by: ${updatedByName}`
  ]);
}

async function notifyChatMessage(user, task, senderName, messageText) {
  const preview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    `${task.title} | Message from ${senderName}: ${preview}`
  ]);
}

async function testWhatsApp(phone) {
  return sendGupshupTemplate(phone, TEMPLATE_NEW_TASK, ['TVS DOT - WhatsApp test successful!']);
}

module.exports = {
  sendGupshupTemplate,
  notifyTaskAssigned,
  notifyTaskPending,
  notifyTaskLate,
  notifyReminder,
  notifyStatusUpdate,
  notifyChatMessage,
  testWhatsApp
};
