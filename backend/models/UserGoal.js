const mongoose = require('mongoose');

const userGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
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
    month: {
      type: Date,
      required: [true, 'Goal month is required'],
    },
    targetCount: {
      type: Number,
      required: [true, 'Target count is required'],
      min: 1,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userGoalSchema.index({ user: 1, project: 1, month: 1 }, { unique: true });
userGoalSchema.index({ companyId: 1, user: 1 });

userGoalSchema.pre(/^find/, function (next) {
  if (this.getFilter().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('UserGoal', userGoalSchema);
