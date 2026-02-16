const express = require('express');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');
const { protect, permit } = require('../middleware/auth');
const { updateRoleRules, userIdParamRules } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users in the company
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of company users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/', permit('users:list'), async (req, res, next) => {
  try {
    const users = await User.find({ companyId: req.user.companyId })
      .select('-password')
      .sort({ createdAt: 1 });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', userIdParamRules, permit('users:read'), async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Update a user's role (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, MEMBER]
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *       403:
 *         description: Not authorized (ADMIN only)
 *       404:
 *         description: User not found
 */
router.put('/:id/role', updateRoleRules, permit('users:update-role'), async (req, res, next) => {
  try {
    const { role } = req.body;

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Soft delete a user (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User removed
 *       400:
 *         description: Cannot remove yourself
 *       403:
 *         description: Not authorized (ADMIN only)
 *       404:
 *         description: User not found
 */
router.delete('/:id', userIdParamRules, permit('users:remove'), async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ status: 'error', message: 'You cannot remove yourself' });
    }

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    await user.softDelete();

    ActivityLog.create({
      action: 'USER_REMOVED',
      description: `${req.user.name} removed ${user.name} from the team`,
      company: req.user.company,
      companyId: req.user.companyId,
      performedBy: req.user._id,
      targetType: 'User',
      targetId: user._id,
    }).catch((err) => logger.warn('Activity log failed', { error: err.message }));

    res.json({ message: 'User removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
