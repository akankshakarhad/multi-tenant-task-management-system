const express = require('express');
const UserFeedback = require('../models/UserFeedback');
const User = require('../models/User');
const Project = require('../models/Project');
const { protect, permit } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const notify = require('../services/notificationService');

const router = express.Router();
router.use(protect);

const createFeedbackRules = [
  body('targetUserId').isMongoId().withMessage('Valid target user ID is required'),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isString().isLength({ max: 1000 }),
  body('completedInTimeline').optional().isBoolean(),
];

// POST /api/feedback — Create feedback (MANAGER only)
router.post('/', createFeedbackRules, permit('feedback:create'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { targetUserId, projectId, rating, comment, completedInTimeline } = req.body;
    const { companyId, company } = req.user;

    // Verify target user is in same company
    const targetUser = await User.findOne({ _id: targetUserId, companyId, isDeleted: false });
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'Target user not found' });
    }

    // Can only give feedback to MEMBER role users
    if (targetUser.role !== 'MEMBER') {
      return res.status(403).json({ status: 'error', message: 'You can only give feedback to members' });
    }

    // Verify project exists in same company
    const project = await Project.findOne({ _id: projectId, companyId });
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    // Manager must be a member of this project
    const memberIds = project.members.map((m) => m.toString());
    if (!memberIds.includes(req.user._id.toString())) {
      return res.status(403).json({ status: 'error', message: 'You are not a member of this project' });
    }

    // Target user must also be a member of this project
    if (!memberIds.includes(targetUserId)) {
      return res.status(403).json({ status: 'error', message: 'This user is not a member of the selected project' });
    }

    // Check for duplicate
    const existing = await UserFeedback.findOne({
      givenBy: req.user._id,
      targetUser: targetUserId,
      project: projectId,
      companyId,
    });
    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already given feedback for this user on this project',
      });
    }

    const feedback = await UserFeedback.create({
      targetUser: targetUserId,
      givenBy: req.user._id,
      project: projectId,
      company,
      companyId,
      rating,
      comment: comment || '',
      completedInTimeline: completedInTimeline ?? null,
    });

    const populated = await feedback.populate([
      { path: 'givenBy', select: 'name' },
      { path: 'project', select: 'name' },
      { path: 'targetUser', select: 'name' },
    ]);

    // Notify the member about their feedback
    notify.feedbackReceived({ feedback, project, userId: targetUserId, actor: req.user })
      .catch(() => {});

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

// GET /api/feedback?targetUser=xxx — List feedback
router.get('/', permit('feedback:list'), async (req, res, next) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.query.targetUser) {
      filter.targetUser = req.query.targetUser;
    } else if (req.user.role === 'MEMBER') {
      filter.targetUser = req.user._id;
    }

    const feedback = await UserFeedback.find(filter)
      .populate('givenBy', 'name')
      .populate('project', 'name status')
      .populate('targetUser', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: feedback });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
