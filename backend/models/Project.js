const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'],
      default: 'ACTIVE',
    },
    deadline: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

projectSchema.index({ companyId: 1 });
projectSchema.index({ company: 1 });
// Compound indexes for filtered listing + pagination
projectSchema.index({ companyId: 1, isDeleted: 1, createdAt: -1 });
projectSchema.index({ companyId: 1, isDeleted: 1, members: 1 });

projectSchema.pre(/^find/, function (next) {
  if (this.getFilter().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  next();
});

projectSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);
