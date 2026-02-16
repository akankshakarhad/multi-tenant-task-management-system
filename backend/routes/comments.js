const express = require('express');
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');
const notify = require('../services/notificationService');
const { protect, permit } = require('../middleware/auth');
const {
  createCommentRules,
  commentTaskIdQueryRules,
  commentIdParamRules,
} = require('../middleware/validate');

const router = express.Router();
router.use(protect);

const populateFields = [
  { path: 'author', select: 'name email' },
  { path: 'mentions', select: 'name email' },
  { path: 'task', select: 'title' },
];

async function resolveMentions(text, companyId) {
  const regex = /@"([^"]+)"|@(\w+)/g;
  const names = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    names.push(match[1] || match[2]);
  }

  if (names.length === 0) return [];

  const orConditions = names.map((n) => ({
    name: { $regex: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  }));

  const users = await User.find({
    companyId,
    $or: orConditions,
  }).select('_id');

  return [...new Set(users.map((u) => u._id.toString()))];
}

function logActivity(action, user, comment, extra = {}) {
  return ActivityLog.create({
    action,
    description: extra.description || '',
    company: user.company,
    companyId: user.companyId,
    performedBy: user._id,
    targetType: 'Comment',
    targetId: comment._id,
    metadata: extra.metadata || null,
  }).catch((err) => logger.warn('Activity log failed', { error: err.message }));
}

/**
 * @swagger
 * /comments:
 *   get:
 *     summary: List comments for a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID to fetch comments for
 *     responses:
 *       200:
 *         description: Array of comments sorted by creation date
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Task not found
 */
router.get('/', commentTaskIdQueryRules, permit('comments:list'), async (req, res, next) => {
  try {
    const { taskId } = req.query;

    const task = await Task.findOne({ _id: taskId, companyId: req.user.companyId });
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found in your company' });
    }

    const comments = await Comment.find({
      task: taskId,
      companyId: req.user.companyId,
    })
      .populate(populateFields)
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /comments:
 *   post:
 *     summary: Add a comment to a task (supports @mentions)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Mention users with `@"Full Name"` or `@name` syntax.
 *       Mentioned users receive notifications automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, taskId]
 *             properties:
 *               text:
 *                 type: string
 *                 maxLength: 5000
 *                 example: 'Looks good! @"Jane Doe" please review.'
 *               taskId:
 *                 type: string
 *                 description: Task ID to comment on
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Task not found
 */
router.post('/', createCommentRules, permit('comments:create'), async (req, res, next) => {
  try {
    const { text, taskId } = req.body;

    const task = await Task.findOne({
      _id: taskId,
      companyId: req.user.companyId,
    });
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found in your company' });
    }

    const mentions = await resolveMentions(text, req.user.companyId);

    const comment = await Comment.create({
      text,
      task: task._id,
      company: req.user.company,
      companyId: req.user.companyId,
      author: req.user._id,
      mentions,
    });

    await logActivity('COMMENT_ADDED', req.user, comment, {
      description: `Comment added on task "${task.title}"`,
      metadata: { taskId: task._id, mentionCount: mentions.length },
    });

    if (task.assignedTo) {
      await notify.commentAdded({
        task, comment, actor: req.user, notifyUserId: task.assignedTo,
      });
    }
    if (task.createdBy && String(task.createdBy) !== String(task.assignedTo)) {
      await notify.commentAdded({
        task, comment, actor: req.user, notifyUserId: task.createdBy,
      });
    }

    const alreadyNotified = new Set(
      [task.assignedTo, task.createdBy, req.user._id]
        .filter(Boolean)
        .map(String)
    );
    for (const mentionedId of mentions) {
      if (!alreadyNotified.has(String(mentionedId))) {
        await notify.commentMentioned({
          task, comment, actor: req.user, mentionedUserId: mentionedId,
        });
      }
    }

    const populated = await comment.populate(populateFields);
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /comments/{id}:
 *   delete:
 *     summary: Soft delete a comment (ADMIN, MANAGER)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', commentIdParamRules, permit('comments:delete'), async (req, res, next) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!comment) {
      return res.status(404).json({ status: 'error', message: 'Comment not found' });
    }

    await comment.softDelete();

    await logActivity('COMMENT_DELETED', req.user, comment, {
      description: 'Comment deleted',
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
