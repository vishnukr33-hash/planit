const nodemailer = require('nodemailer');
const axios = require('axios');

let settingsCache = null;
function getConfig() {
  if (!settingsCache) {
    try {
      const fs = require('fs');
      const path = require('path');
      const file = path.join(__dirname, '..', 'settings.json');
      if (fs.existsSync(file)) {
        settingsCache = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {}
  }
  return {
    host: settingsCache?.emailHost || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(settingsCache?.emailPort || process.env.EMAIL_PORT || 465),
    user: settingsCache?.emailUser || process.env.EMAIL_USER || '',
    pass: settingsCache?.emailPass || process.env.EMAIL_PASS || '',
    resendKey: process.env.RESEND_API_KEY || '',
  };
}

/**
 * Send email via Resend HTTP API (works on Render free tier)
 * Falls back to SMTP if Resend key not set
 */
async function sendViaResend(config, { to, subject, html }) {
  const res = await axios.post('https://api.resend.com/emails', {
    from: 'Planit <onboarding@resend.dev>',
    to: [to],
    subject,
    html,
  }, {
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
  return res.data;
}

async function sendViaSMTP(config, { to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  await transporter.sendMail({
    from: `"Planit" <${config.user}>`,
    to,
    subject,
    html,
  });
}

exports.sendEmail = async ({ to, subject, html }) => {
  const config = getConfig();

  // Try Resend API first (works on Render free tier)
  if (config.resendKey) {
    try {
      await sendViaResend(config, { to, subject, html });
      console.log(`[Email-Resend] Sent to ${to}: ${subject}`);
      return;
    } catch (err) {
      console.error(`[Email-Resend] FAILED to ${to}:`, err.response?.data || err.message);
    }
  }

  // Fallback to SMTP (works locally, may not work on Render free tier)
  if (config.user && config.pass) {
    try {
      await sendViaSMTP(config, { to, subject, html });
      console.log(`[Email-SMTP] Sent to ${to}: ${subject}`);
      return;
    } catch (err) {
      console.error(`[Email-SMTP] FAILED to ${to}:`, err.message);
    }
  }

  console.log('[Email] Skipped — no credentials configured. To:', to);
};

exports.clearEmailCache = () => { settingsCache = null; };
