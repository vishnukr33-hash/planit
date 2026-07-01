const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loginAt: { type: Date, default: Date.now },
  logoutAt: { type: Date, default: null },
  duration: { type: Number, default: 0 }, // in minutes
}, { timestamps: true });

module.exports = mongoose.models.LoginLog || mongoose.model('LoginLog', loginLogSchema);
