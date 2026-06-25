const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['comment', 'status_update'],
    default: 'comment'
  },
  statusFrom: String,
  statusTo: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    status: {
      type: String,
      enum: [
        'Pending',
        'Accepted',
        'In Progress',
        'Need Discussion',
        'Done',
        'Delayed'
      ],
      default: 'Pending'
    },

    category: {
      type: String,
      enum: [
        'Website Update',
        'Legal',
        'AI',
        'Operations',
        'Marketing',
        'Development',
        'Others'
      ],
      default: 'Others'
    },

    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },

    dueDate: Date,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    isTeamTask: {
      type: Boolean,
      default: false
    },

    comments: [commentSchema],

    attachments: [
      {
        name: String,
        url: String
      }
    ],

    completedAt: Date,

    reminderSent: {
      type: Boolean,
      default: false
    },

    hourReminderSent: {
      type: Boolean,
      default: false
    },

    lockedByDone: {
      type: Boolean,
      default: false
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

taskSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'Done') {
    if (!this.completedAt) {
      this.completedAt = new Date();
    }

    if (this.isTeamTask) {
      this.lockedByDone = true;
    }
  }

  next();
});

module.exports =
  mongoose.models.Task || mongoose.model('Task', taskSchema);
