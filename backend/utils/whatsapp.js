const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || process.env.GUPSHUP_API_KEY || '';
const APP_NAME = process.env.WHATSAPP_APP_NAME || '';
const SOURCE_NUMBER = '917305045046';
const BASE_URL = 'https://api.gupshup.io/wa/api/v1/msg';
const TEMPLATE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

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

  console.log('[WhatsApp] Template to:', normalized, 'Template:', templateId);

  const payload =
    'source=' + SOURCE_NUMBER +
    '&destination=' + normalized +
    '&template=' + encodeURIComponent(JSON.stringify({ id: templateId, params: params || [] }));

  try {
    const res = await axios.post(TEMPLATE_URL, payload, {
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    console.log('[WhatsApp] Template sent:', res.data?.status || 'ok');
    return res.data;
  } catch (err) {
    console.error('[WhatsApp] Template error:', err.response?.data || err.message);
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

// === NOTIFICATION FUNCTIONS ===

async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No due date';

  // Try template first
  const result = await sendGupshupTemplate(user.phone, '28160587806875627', [
    user.name, task.title, task.priority, dueStr, assignedByName
  ]);

  // Fallback to text message if template fails
  if (!result) {
    await sendTextMessage(user.phone,
      `📋 *New Task Assigned*\n\nHi ${user.name},\n\n` +
      `*Task:* ${task.title}\n` +
      `*Priority:* ${task.priority}\n` +
      `*Due:* ${dueStr}\n` +
      `*Assigned by:* ${assignedByName}\n\n` +
      `Please login to Planit to start working on it.`
    );
  }
}

async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';

  const result = await sendGupshupTemplate(user.phone, '1057554603269663', [
    user.name, task.title, dueStr, task.status, task.priority
  ]);

  if (!result) {
    await sendTextMessage(user.phone,
      `⏰ *Task Reminder*\n\nHi ${user.name},\n\n` +
      `*Task:* ${task.title}\n` +
      `*Due:* ${dueStr}\n` +
      `*Status:* ${task.status}\n` +
      `*Priority:* ${task.priority}\n\n` +
      `Please update the task status in Planit.`
    );
  }
}

async function notifyTaskLate(user, task) {
  const dueTime = task.dueDate
    ? new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const result = await sendGupshupTemplate(user.phone, '2056861468282029', [
    user.name, task.title, dueTime, task.status, task.priority
  ]);

  if (!result) {
    await sendTextMessage(user.phone,
      `🚨 *Urgent: Task Due in 1 Hour!*\n\nHi ${user.name},\n\n` +
      `*Task:* ${task.title}\n` +
      `*Due at:* ${dueTime}\n` +
      `*Status:* ${task.status}\n` +
      `*Priority:* ${task.priority}\n\n` +
      `Please complete it immediately or update the status.`
    );
  }
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

  await sendTextMessage(user.phone,
    `🔄 *Task Status Update*\n\n` +
    `*Task:* ${task.title}\n` +
    `*New Status:* ${task.status}\n` +
    `*Priority:* ${task.priority}\n` +
    `*Due:* ${dueStr}\n` +
    `*Updated by:* ${updatedByName}`
  );
}

// Send chat message notification via WhatsApp
async function notifyChatMessage(user, task, senderName, messageText) {
  await sendTextMessage(user.phone,
    `💬 *New Message on Task*\n\n` +
    `*Task:* ${task.title}\n` +
    `*From:* ${senderName}\n` +
    `*Message:* ${messageText}\n\n` +
    `Open Planit to reply.`
  );
}

async function testWhatsApp(phone) {
  return sendTextMessage(phone, '✅ *Planit Test*\nWhatsApp integration is working!');
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
