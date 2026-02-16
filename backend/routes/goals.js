const express = require('express');
const UserGoal = require('../models/UserGoal');
const User = require('../models/User');
const Project = require('../models/Project');
const { protect, permit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const notify = require('../services/notificationService');

const router = express.Router();
router.use(protect);

const createGoalRules = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('month').isISO8601().withMessage('Valid month date is required'),
  body('targetCount').isInt({ min: 1 }).withMessage('Target count must be at least 1'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
];

const updateGoalRules = [
  body('targetCount').optional().isInt({ min: 1 }).withMessage('Target count must be at least 1'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
];

/**
 * @swagger
 * /goals:
 *   post:
 *     summary: Create a monthly goal for a user
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       ADMIN/MANAGER can set monthly task completion goals for users on specific projects.
 *       One goal per user-project-month combination (unique constraint).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, projectId, month, targetCount]
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user this goal is for
 *               projectId:
 *                 type: string
 *                 description: ID of the project
 *               month:
 *                 type: string
 *                 format: date
 *                 description: Any date in the target month (normalized to 1st)
 *                 example: '2026-02-01'
 *               targetCount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of tasks to complete
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Goal created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserGoal'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User or project not found
 *       409:
 *         description: Goal already exists for this user-project-month
 */
router.post('/', createGoalRules, permit('goals:create'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { userId, projectId, month, targetCount, description } = req.body;
    const { companyId, company } = req.user;

    // Verify user is in same company
    const user = await User.findOne({ _id: userId, companyId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Verify project exists in same company
    const project = await Project.findOne({ _id: projectId, companyId });
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    // Normalize month to 1st of month
    const monthDate = new Date(month);
    monthDate.setDate(1);
    monthDate.setHours(0, 0, 0, 0);

    const goal = await UserGoal.create({
      user: userId,
      project: projectId,
      company,
      companyId,
      month: monthDate,
      targetCount,
      description: description || '',
    });

    const populated = await goal.populate('project', 'name status');

    // Notify the member about their new goal
    notify.goalAssigned({ goal, project, userId, actor: req.user })
      .catch(() => {});

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: 'error',
        message: 'A goal already exists for this user, project, and month',
      });
    }
    next(error);
  }
});

/**
 * @swagger
 * /goals/{id}:
 *   put:
 *     summary: Update a goal's target count or description
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Goal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetCount:
 *                 type: integer
 *                 minimum: 1
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Goal updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserGoal'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Goal not found
 */
router.put('/:id', updateGoalRules, permit('goals:update'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      isDeleted: false,
    });

    if (!goal) {
      return res.status(404).json({ status: 'error', message: 'Goal not found' });
    }

    if (req.body.targetCount !== undefined) goal.targetCount = req.body.targetCount;
    if (req.body.description !== undefined) goal.description = req.body.description;
    await goal.save();

    const populated = await goal.populate('project', 'name status');
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /goals:
 *   get:
 *     summary: List goals
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       ADMIN/MANAGER can filter by userId and month. MEMBER sees only their own goals.
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (ADMIN/MANAGER only)
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: '2026-02'
 *         description: Filter by month (YYYY-MM format)
 *     responses:
 *       200:
 *         description: Goals list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserGoal'
 *       403:
 *         description: Access denied (MEMBER viewing another user's goals)
 */
router.get('/', permit('goals:list'), async (req, res, next) => {
  try {
    const filter = { companyId: req.user.companyId, isDeleted: false };

    if (req.query.userId) {
      if (
        req.user.role === 'MEMBER' &&
        String(req.query.userId) !== String(req.user._id)
      ) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
      filter.user = req.query.userId;
    } else if (req.user.role === 'MEMBER') {
      filter.user = req.user._id;
    }

    if (req.query.month) {
      const monthDate = new Date(req.query.month + '-01');
      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      filter.month = { $gte: monthDate, $lt: nextMonth };
    }

    const goals = await UserGoal.find(filter)
      .populate('project', 'name status')
      .populate('user', 'name')
      .sort({ month: -1 })
      .lean();

    res.json({ data: goals });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
