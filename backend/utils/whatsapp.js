const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || '';
const APP_NAME = process.env.WHATSAPP_APP_NAME || '';
const SOURCE_NUMBER = '917305045046';
const TEMPLATE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

// Gupshup Template IDs (use Gupshup template ID, NOT Facebook template ID)
const TEMPLATE_NEW_TASK = process.env.WHATSAPP_TEMPLATE_NEW_TASK || 'e4fe8bc8-bb0a-4cfe-8f4c-de7136339a9c';
const TEMPLATE_TASK_PENDING = process.env.WHATSAPP_TEMPLATE_TASK_PENDING || 'e4fe8bc8-bb0a-4cfe-8f4c-de7136339a9c';
const TEMPLATE_TASK_LATE = process.env.WHATSAPP_TEMPLATE_TASK_LATE || 'e4fe8bc8-bb0a-4cfe-8f4c-de7136339a9c';

function normalizePhone(phone) {
  if (!phone) return null;
  let normalized = String(phone).replace(/[\s\-\+]/g, '');
  // Add India country code if only 10 digits
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

// Send plain text message via Gupshup
async function sendTextMessage(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized || !API_KEY) {
    console.log('[WhatsApp] Skipped - no phone or API key');
    return;
  }

  console.log('[WhatsApp] Text to:', normalized);

  const payload = new URLSearchParams({
    channel: 'whatsapp',
    source: SOURCE_NUMBER,
    destination: normalized,
    'src.name': APP_NAME,
    message: JSON.stringify({ type: 'text', text: message }),
  }).toString();

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    console.log('[WhatsApp] Text sent:', res.data?.status || 'ok');
    return res.data;
  } catch (err) {
    console.error('[WhatsApp] Text error:', err.response?.data || err.message);
  }
}

// === TEMPLATE IDS ===
const TEMPLATE_NEW_TASK = '28160587806875627';      // new_task - At time of task assigning
const TEMPLATE_TASK_PENDING = '1057554603269663';   // task_pending - N-1 Day before due date
const TEMPLATE_TASK_LATE = '2056861468282029';      // task_late - After due date, daily 9 AM

// === NOTIFICATION FUNCTIONS ===

// Trigger 1: At the time of Task Assigning (new_task template)
async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No due date';

  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    user.name, task.title, task.priority, dueStr, assignedByName
  ]);
}

// Trigger 2: N-1 Day of Task Due Date (task_pending template)
async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';

  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_PENDING, [
    user.name, task.title, dueStr, task.status, task.priority
  ]);
}

// Trigger 3: After Due Date and Time - Every Day 9:00 AM (task_late template)
async function notifyTaskLate(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';

  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_LATE, [
    user.name, task.title, dueStr, task.status, task.priority
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
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';

  // Use new_task template for status updates (reuse existing approved template)
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    user.name,
    `${task.title} - Status: ${task.status}`,
    task.priority,
    dueStr,
    updatedByName
  ]);
}

// Send chat message notification via WhatsApp (uses approved template)
async function notifyChatMessage(user, task, senderName, messageText) {
  // Use new_task template for chat notifications (reuse existing approved template)
  const msgPreview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, [
    user.name,
    `Reply on: ${task.title}`,
    'Message',
    msgPreview,
    senderName
  ]);
}

async function testWhatsApp(phone) {
  return sendTextMessage(phone, '✅ *TVS DOT Test*\nWhatsApp integration is working!');
}

module.exports = {
  sendGupshupTemplate,
  sendTextMessage,
  notifyTaskAssigned,
  notifyTaskPending,
  notifyTaskLate,
  notifyReminder,
  notifyStatusUpdate,
  notifyChatMessage,
  testWhatsApp
};
