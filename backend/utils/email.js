const nodemailer = require('nodemailer');
const { getEmailConfig } = require('./settings');

function createTransporter() {
  const config = getEmailConfig();
  if (!config.user || !config.pass) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: { user: config.user, pass: config.pass }
  });
}

exports.sendEmail = async ({ to, subject, html }) => {
  const config = getEmailConfig();
  if (!config.user || !config.pass) {
    console.log('[Email] Skipped — no SMTP credentials configured. To:', to, 'Subject:', subject);
    return;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Planit" <${config.user}>`,
      to,
      subject,
      html
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[Email] FAILED to ${to}:`, err.message);
  }
};
