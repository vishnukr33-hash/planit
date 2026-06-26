const nodemailer = require('nodemailer');

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
  };
}

// Create transporter once and reuse
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const config = getConfig();
  if (!config.user || !config.pass) return null;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  return transporter;
}

exports.sendEmail = async ({ to, subject, html }) => {
  const config = getConfig();

  if (!config.user || !config.pass) {
    console.log('[Email] Skipped — no credentials configured. To:', to);
    return;
  }

  try {
    const transport = getTransporter();
    if (!transport) {
      console.log('[Email] Skipped — transport not available. To:', to);
      return;
    }

    await transport.sendMail({
      from: `"Planit" <${config.user}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[Email] FAILED to ${to}:`, err.message);
    // Reset transporter on failure so it retries connection next time
    transporter = null;
  }
};

exports.clearEmailCache = () => { settingsCache = null; transporter = null; };
