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

async function notifyTaskAssigned(user, task, assignedByName) {
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, []);
}

async function notifyTaskPending(user, task) {
  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_PENDING, []);
}

async function notifyTaskLate(user, task) {
  return sendGupshupTemplate(user.phone, TEMPLATE_TASK_LATE, []);
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
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, []);
}

async function notifyChatMessage(user, task, senderName, messageText) {
  return sendGupshupTemplate(user.phone, TEMPLATE_NEW_TASK, []);
}

async function testWhatsApp(phone) {
  return sendGupshupTemplate(phone, TEMPLATE_NEW_TASK, []);
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
