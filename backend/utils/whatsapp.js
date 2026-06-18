/**
 * WhatsApp messaging via Interakt API
 * Uses approved templates for outbound notifications
 * 
 * Templates:
 * 1. new_task (ID: 28160587806875627) — when admin assigns a task
 * 2. task_pending (ID: 1057554603269663) — N-1 day reminder at 9 AM
 * 3. task_late (ID: 2056861468282029) — N-1 hour before due time
 */
const axios = require('axios');

const API_KEY = process.env.WHATSAPP_API_KEY || 'sk_9548d4db0d704872bee3367ac0dd0399';
const BASE_URL = 'https://api.interakt.ai/v1/public/message/';

/**
 * Send a WhatsApp template message
 * @param {string} phone - with country code e.g. "919876543210"
 * @param {string} templateName - approved template name
 * @param {string[]} bodyValues - ordered placeholder values
 */
async function sendWhatsAppTemplate(phone, templateName, bodyValues = []) {
  if (!phone) return;
  const normalized = phone.replace(/[\s\-\+]/g, '');
  if (normalized.length < 10) {
    console.warn('[WhatsApp] Invalid phone:', phone);
    return;
  }

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

  console.log(`[WhatsApp] Sending [${templateName}] to ${normalized}, key: ${API_KEY.substring(0,8)}...`);

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Basic ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log(`[WhatsApp] Sent [${templateName}] to ${normalized}:`, res.data?.result || 'OK');
    return res.data;
  } catch (err) {
    console.error(`[WhatsApp] FAILED [${templateName}] to ${normalized}:`, err.response?.data || err.message);
  }
}

/**
 * Template: new_task
 * Sent when admin assigns a new task to a team member
 */
async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No due date';
  return sendWhatsAppTemplate(user.phone, 'new_task', [
    user.name,
    task.title,
    task.priority,
    dueStr,
    assignedByName,
  ]);
}

/**
 * Template: task_pending
 * Sent N-1 day before due date at 9:00 AM
 */
async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';
  return sendWhatsAppTemplate(user.phone, 'task_pending', [
    user.name,
    task.title,
    dueStr,
    task.status,
    task.priority,
  ]);
}

/**
 * Template: task_late
 * Sent N-1 hour before task due time
 */
async function notifyTaskLate(user, task) {
  const dueTime = task.dueDate
    ? new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'N/A';
  return sendWhatsAppTemplate(user.phone, 'task_late', [
    user.name,
    task.title,
    dueTime,
    task.status,
    task.priority,
  ]);
}

/**
 * Generic reminder (backward compat)
 */
async function notifyReminder(user, task, reminderType) {
  if (reminderType === 'due tomorrow') {
    return notifyTaskPending(user, task);
  } else if (reminderType && reminderType.includes('hour')) {
    return notifyTaskLate(user, task);
  }
  return notifyTaskPending(user, task);
}

/**
 * Status update notification (uses new_task template as fallback)
 */
async function notifyStatusUpdate(user, task, updatedByName) {
  return sendWhatsAppTemplate(user.phone, 'new_task', [
    user.name,
    task.title + ' — Status: ' + task.status,
    task.priority,
    task.dueDate ? new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A',
    updatedByName,
  ]);
}

/**
 * Test WhatsApp
 */
async function testWhatsApp(phone) {
  return sendWhatsAppTemplate(phone, 'new_task', [
    'Test User', 'Test Task', 'High', new Date().toLocaleString('en-IN'), 'Admin',
  ]);
}

module.exports = { sendWhatsAppTemplate, notifyTaskAssigned, notifyTaskPending, notifyTaskLate, notifyReminder, notifyStatusUpdate, testWhatsApp };
