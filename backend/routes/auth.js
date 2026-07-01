const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const { protect } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ $or: [{ username }, { email: username }] }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.status === 'inactive') return res.status(403).json({ message: 'Account is inactive' });

    const token = signToken(user._id);

    // Record login
    const loginLog = await LoginLog.create({ user: user._id, loginAt: new Date() });

    res.json({ token, user: user.toJSON(), sessionId: loginLog._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear all tasks (admin only) — DELETE /api/auth/clear-tasks
router.delete('/clear-tasks', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const Task = require('../models/Task');
  const result = await Task.deleteMany({});
  console.log('[Admin] Cleared all tasks:', result.deletedCount);
  res.json({ message: `Deleted ${result.deletedCount} tasks` });
});

// Get current user
router.get('/me', protect, (req, res) => res.json(req.user));

// Logout — record session end
router.post('/logout', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      const log = await LoginLog.findById(sessionId);
      if (log && !log.logoutAt) {
        log.logoutAt = new Date();
        log.duration = Math.round((log.logoutAt - log.loginAt) / 60000); // minutes
        await log.save();
      }
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(200).json({ message: 'Logged out' });
  }
});

// Test WhatsApp (admin only) — GET /api/auth/test-whatsapp?phone=919876543210
router.get('/test-whatsapp', protect, async (req, res) => {
  try {
    const { testWhatsApp } = require('../utils/whatsapp');
    const phone = req.query.phone || req.user.phone;
    if (!phone) return res.status(400).json({ message: 'No phone number. Pass ?phone=919876543210' });
    const result = await testWhatsApp(phone);
    res.json({ message: 'WhatsApp test sent', phone, result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get email settings (admin only)
router.get('/email-settings', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { getEmailConfig } = require('../utils/settings');
  const config = getEmailConfig();
  res.json({ host: config.host, port: config.port, user: config.user, pass: config.pass ? '••••••' : '' });
});

// Update email settings (admin only)
router.put('/email-settings', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { saveSettings } = require('../utils/settings');
  const { host, port, user, pass } = req.body;
  const saved = saveSettings({ emailHost: host, emailPort: port, emailUser: user, emailPass: pass });
  console.log('[Settings] Email config updated by admin');
  res.json({ message: 'Email settings saved', host: saved.emailHost, port: saved.emailPort, user: saved.emailUser });
});

// Update own profile (any logged-in user)
router.put('/profile', protect, async (req, res) => {
  try {
    const { phone, avatar } = req.body;
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: 'No user with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 10 minutes.</p>`
    });
    res.json({ message: 'Reset email sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Token invalid or expired' });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
