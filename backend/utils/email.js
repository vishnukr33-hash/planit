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

exports.sendEmail = async ({ to, subject, html }) => {
  const config = getConfig();
  if (!config.user || !config.pass) {
    console.log('[Email] Skipped — no credentials. To:', to);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: 465,
      secure: true,
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
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[Email] FAILED to ${to}:`, err.message);
  }
};

exports.clearEmailCache = () => { settingsCache = null; };
