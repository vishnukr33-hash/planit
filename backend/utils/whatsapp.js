/**
 * WhatsApp messaging via Interakt API
 * Uses both Text messages (for 24hr window) and Template messages
 * API Key: passed as-is in Authorization header (not base64)
 */
const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || 'sk_9548d4db0d704872bee3367ac0dd0399';
const BASE_URL = 'https://api.interakt.ai/v1/public/message/';

/**
 * Send a plain text WhatsApp message
 */
async function sendWhatsAppText(phone, message) {
  if (!phone) return;
  const normalized = phone.replace(/[\s\-\+]/g, '');
  if (normalized.length < 10) return;

  const payload = {
    countryCode: '+91',
    phoneNumber: normalized,
    callbackData: 'planit_notification',
    type: 'Text',
    data: { message },
  };

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Basic ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log(`[WhatsApp-Text] Sent to ${normalized}:`, res.data?.result || 'OK');
    return res.data;
  } catch (err) {
    console.error(`[WhatsApp-Text] FAILED to ${normalized}:`, err.response?.data || err.message);
    // If text fails (24hr window expired), try template
    return sendWhatsAppTemplate(normalized, message);
  }
}

/**
 * Send a template message (fallback for outside 24hr window)
 * Uses 'hello_world' default template or custom if available
 */
async function sendWhatsAppTemplate(phone, message) {
  const normalized = phone.replace(/[\s\-\+]/g, '');
  const payload = {
    countryCode: '+91',
    phoneNumber: normalized,
    callbackData: 'planit_notification',
    type: 'Template',
    template: {
      name: 'hello_world',
      languageCode: 'en_US',
      bodyValues: [],
    },
  };

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Basic ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log(`[WhatsApp-Template] Sent to ${normalized}:`, res.data?.result || 'OK');
    return res.data;
  } catch (err) {
    console.error(`[WhatsApp-Template] FAILED to ${normalized}:`, err.response?.data || err.message);
  }
}

/**
 * Notify user about a newly assigned task
 */
async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';
  const portalUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const msg = `📋 *New Task Assigned*\n\nHi ${user.name},\n\nA new task has been assigned to you.\n\n*Task:* ${task.title}\n*Priority:* ${task.priority}\n*Due:* ${dueStr}\n*Assigned by:* ${assignedByName}\n\nPlease login to accept: ${portalUrl}`;
  return sendWhatsAppText(user.phone, msg);
}

/**
 * Notify user about a task status update
 */
async function notifyStatusUpdate(user, task, updatedByName) {
  const msg = `🔄 *Task Status Updated*\n\nHi ${user.name},\n\n*Task:* ${task.title}\n*New Status:* ${task.status}\n*Updated by:* ${updatedByName}`;
  return sendWhatsAppText(user.phone, msg);
}

/**
 * Send due-date reminder
 */
async function notifyReminder(user, task, reminderType = 'due today') {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
  const portalUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const msg = `⏰ *Task Reminder*\n\nHi ${user.name},\n\nYour task *${task.title}* is *${reminderType}*.\n\n*Due:* ${dueStr}\n*Status:* ${task.status}\n*Priority:* ${task.priority}\n\nUpdate status: ${portalUrl}`;
  return sendWhatsAppText(user.phone, msg);
}

/**
 * Test WhatsApp connection
 */
async function testWhatsApp(phone) {
  return sendWhatsAppText(phone, '✅ Planit WhatsApp test message. If you see this, notifications are working!');
}

module.exports = { sendWhatsAppText, sendWhatsAppTemplate, notifyTaskAssigned, notifyStatusUpdate, notifyReminder, testWhatsApp };
