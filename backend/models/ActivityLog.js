const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: [
        'COMPANY_CREATED',
        'USER_JOINED',
        'USER_REMOVED',
        'PROJECT_CREATED',
        'PROJECT_UPDATED',
        'PROJECT_DELETED',
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_DELETED',
        'TASK_ASSIGNED',
        'TASK_STATUS_CHANGED',
        'COMMENT_ADDED',
        'COMMENT_DELETED',
      ],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    companyId: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['Company', 'User', 'Project', 'Task', 'Comment'],
      default: null,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ companyId: 1 });
activityLogSchema.index({ company: 1 });
activityLogSchema.index({ performedBy: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
