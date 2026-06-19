const axios = require('axios');

const API_KEY = process.env.GUPSHUP_API_KEY || 'YOUR_API_KEY';
const BASE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

async function sendGupshupTemplate(phone, templateId, params) {
  if (!phone) {
    console.log('[WhatsApp] No phone number found');
    return;
  }

  let normalized = String(phone).replace(/[\s\-\+]/g, '');

  // Add India country code if only 10 digits
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }

  console.log('[WhatsApp] Phone:', normalized);
  console.log('[WhatsApp] Template:', templateId);
  console.log('[WhatsApp] Params:', params);

  const payload =
    'source=917305045046' +
    '&destination=' +
    normalized +
    '&template=' +
    encodeURIComponent(
      JSON.stringify({
        id: templateId,
        params: params || []
      })
    );

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    console.log('[WhatsApp-Gupshup] SUCCESS');
    console.log('[WhatsApp-Gupshup] Response:', JSON.stringify(res.data));

    return res.data;
  } catch (err) {
    console.error(
      '[WhatsApp-Gupshup] ERROR:',
      JSON.stringify(err.response?.data || err.message)
    );
  }
}

async function notifyTaskAssigned(user, task, assignedByName) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN')
    : 'No due date';

  return sendGupshupTemplate(
    user.phone,
    '28160587806875627',
    [
      user.name,
      task.title,
      task.priority,
      dueStr,
      assignedByName
    ]
  );
}

async function notifyTaskPending(user, task) {
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleString('en-IN')
    : 'N/A';

  return sendGupshupTemplate(
    user.phone,
    '1057554603269663',
    [
      user.name,
      task.title,
      dueStr,
      task.status,
      task.priority
    ]
  );
}

async function notifyTaskLate(user, task) {
  const dueTime = task.dueDate
    ? new Date(task.dueDate).toLocaleTimeString('en-IN')
    : 'N/A';

  return sendGupshupTemplate(
    user.phone,
    '2056861468282029',
    [
      user.name,
      task.title,
      dueTime,
      task.status,
      task.priority
    ]
  );
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
    ? new Date(task.dueDate).toLocaleString('en-IN')
    : 'N/A';

  return sendGupshupTemplate(
    user.phone,
    '28160587806875627',
    [
      user.name,
      `${task.title} [${task.status}]`,
      task.priority,
      dueStr,
      updatedByName
    ]
  );
}

async function testWhatsApp(phone) {
  return sendGupshupTemplate(
    phone,
    '28160587806875627',
    [
      'Test User',
      'Test Task',
      'High',
      new Date().toLocaleString('en-IN'),
      'Admin'
    ]
  );
}

module.exports = {
  sendGupshupTemplate,
  notifyTaskAssigned,
  notifyTaskPending,
  notifyTaskLate,
  notifyReminder,
  notifyStatusUpdate,
  testWhatsApp
};
