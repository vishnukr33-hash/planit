const nodemailer = require('nodemailer');

function getConfig() {
  return {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 465),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  };
}

exports.sendEmail = async function(options) {
  var config = getConfig();
  if (!config.user || !config.pass) {
    console.log('[Email] Skipped - no credentials. To:', options.to);
    return;
  }
  try {
    var transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: true,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000
    });
    await transporter.sendMail({
      from: '"Planit" <' + config.user + '>',
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log('[Email] Sent to ' + options.to + ': ' + options.subject);
  } catch (err) {
    console.error('[Email] FAILED to ' + options.to + ':', err.message);
  }
};
