const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { activityLogQueryRules } = require('../middleware/validate');
const ActivityLog = require('../models/ActivityLog');

/**
 * @swagger
 * /activity-logs:
 *   get:
 *     summary: List audit log entries (ADMIN only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [COMPANY_CREATED, USER_JOINED, USER_REMOVED, PROJECT_CREATED, PROJECT_UPDATED, PROJECT_DELETED, TASK_CREATED, TASK_UPDATED, TASK_DELETED, TASK_ASSIGNED, TASK_STATUS_CHANGED, COMMENT_ADDED, COMMENT_DELETED]
 *         description: Filter by action type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Audit log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 *                 total:
 *                   type: integer
 *       403:
 *         description: Not authorized (ADMIN only)
 */
router.get('/', protect, authorize('ADMIN'), activityLogQueryRules, async (req, res, next) => {
  try {
    const { action } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const filter = { companyId: req.user.companyId };
    if (action) filter.action = action;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('performedBy', 'name email'),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
