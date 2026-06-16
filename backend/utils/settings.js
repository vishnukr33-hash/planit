/**
 * Runtime settings manager — stores admin-configurable settings in a JSON file
 * Falls back to .env values if settings file doesn't exist
 */
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveSettings(data) {
  const current = loadSettings();
  const merged = { ...current, ...data };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function getEmailConfig() {
  const settings = loadSettings();
  return {
    host: settings.emailHost || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(settings.emailPort || process.env.EMAIL_PORT || 587),
    user: settings.emailUser || process.env.EMAIL_USER || '',
    pass: settings.emailPass || process.env.EMAIL_PASS || '',
  };
}

module.exports = { loadSettings, saveSettings, getEmailConfig };
