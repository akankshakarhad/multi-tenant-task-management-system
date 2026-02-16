const mongoose = require('mongoose');

const userFeedbackSchema = new mongoose.Schema(
  {
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    givenBy: {
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
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    completedInTimeline: {
      type: Boolean,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userFeedbackSchema.index({ targetUser: 1, companyId: 1 });
userFeedbackSchema.index({ project: 1, targetUser: 1 });
userFeedbackSchema.index({ givenBy: 1, targetUser: 1, project: 1 }, { unique: true });

userFeedbackSchema.pre(/^find/, function (next) {
  if (this.getFilter().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('UserFeedback', userFeedbackSchema);
