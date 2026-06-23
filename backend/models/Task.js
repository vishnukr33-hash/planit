

const mongoose = require('mongoose');



const commentSchema = new mongoose.Schema({

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  text: { type: String, required: true },

  type: { type: String, enum: ['comment', 'status_update'], default: 'comment' },

  statusFrom: { type: String },

  statusTo: { type: String },

  createdAt: { type: Date, default: Date.now }

});



const taskSchema = new mongoose.Schema({

  title: { type: String, required: true, trim: true },

  description: { type: String, trim: true, default: '' },

  status: {

    type: String,

    enum: ['Pending', 'Accepted', 'In Progress', 'Need Discussion', 'Done', 'Delayed'],

    default: 'Pending'

  },

  category: {

    type: String,

    enum: ['Website Update', 'Legal', 'AI', 'Operations', 'Marketing', 'Development', 'Others'],

    default: 'Others'

  },

  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },

  dueDate: { type: Date },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  isTeamTask: { type: Boolean, default: false },

  comments: [commentSchema],

  attachments: [{ name: String, url: String }],

  completedAt: { type: Date },

  reminderSent: { type: Boolean, default: false },

  hourReminderSent: { type: Boolean, default: false },

  // Once a team member submits Done, only admin can edit

  lockedByDone: { type: Boolean, default: false },

}, { timestamps: true });



// Auto-set completedAt and lockedByDone

taskSchema.pre('save', function (next) {

  if (this.isModified('status') && this.status === 'Done') {

    if (!this.completedAt) this.completedAt = new Date();

    // Lock task if it's a team task (assigned to someone other than creator)

    if (this.isTeamTask) this.lockedByDone = true;

  }

  next();

});



module.exports = mongoose.model('Task', taskSchema);
