const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter to unread notifications only
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Notification list with counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 total:
 *                   type: integer
 *                 unreadCount:
 *                   type: integer
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {
      recipient: req.user._id,
      companyId: req.user.companyId,
    };

    if (req.query.unreadOnly === 'true') {
      filter.read = false;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('triggeredBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        recipient: req.user._id,
        companyId: req.user.companyId,
        read: false,
      }),
    ]);

    res.json({ notifications, total, unreadCount });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *                   example: 5
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      companyId: req.user.companyId,
      read: false,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Updated notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ status: 'error', message: 'Notification not found' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Number of notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 marked:
 *                   type: integer
 *                   example: 12
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, companyId: req.user.companyId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ marked: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
