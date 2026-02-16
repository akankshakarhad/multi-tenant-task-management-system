const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');
const notify = require('../services/notificationService');
const { protect, permit } = require('../middleware/auth');
const {
  createTaskRules,
  updateTaskRules,
  assignTaskRules,
  taskIdParamRules,
} = require('../middleware/validate');

const router = express.Router();
router.use(protect);

// ── Valid status transitions ────────────────────────────────
const STATUS_FLOW = {
  TODO:        ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'TODO', 'BLOCKER'],
  IN_REVIEW:   ['DONE', 'IN_PROGRESS', 'BLOCKER'],
  DONE:        ['TODO'],
  BLOCKER:     ['TODO', 'IN_PROGRESS'],
};

function isValidTransition(from, to) {
  return STATUS_FLOW[from]?.includes(to) ?? false;
}

const populateFields = [
  { path: 'project', select: 'name' },
  { path: 'assignedTo', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
];

function logActivity(action, user, task, extra = {}) {
  return ActivityLog.create({
    action,
    description: extra.description || '',
    company: user.company,
    companyId: user.companyId,
    performedBy: user._id,
    targetType: 'Task',
    targetId: task._id,
    metadata: extra.metadata || null,
  }).catch((err) => logger.warn('Activity log failed', { error: err.message }));
}

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: List tasks with filters (MEMBER sees only assigned tasks)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by task title
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKER]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assignee user ID
 *       - in: query
 *         name: dueBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Tasks due before this date
 *       - in: query
 *         name: dueAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Tasks due after this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 500
 *     responses:
 *       200:
 *         description: Paginated list of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', permit('tasks:list'), async (req, res, next) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.user.role === 'MEMBER') {
      filter.assignedTo = req.user._id;
    }

    if (req.query.search) {
      const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    if (req.query.projectId)  filter.project    = req.query.projectId;
    if (req.query.status)     filter.status      = req.query.status;
    if (req.query.priority)   filter.priority    = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo  = req.query.assignedTo;

    if (req.query.dueBefore || req.query.dueAfter) {
      filter.dueDate = {};
      if (req.query.dueBefore) filter.dueDate.$lte = new Date(req.query.dueBefore);
      if (req.query.dueAfter)  filter.dueDate.$gte = new Date(req.query.dueAfter);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate(populateFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(filter),
    ]);

    res.json({
      data: tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
router.get('/:id', taskIdParamRules, permit('tasks:read'), async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, companyId: req.user.companyId };
    if (req.user.role === 'MEMBER') {
      filter.assignedTo = req.user._id;
    }

    const task = await Task.findOne(filter).populate(populateFields);
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task (ADMIN, MANAGER)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, projectId]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Implement login page
 *               description:
 *                 type: string
 *               projectId:
 *                 type: string
 *                 description: Project to create the task in
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign the task to
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Project or assignee not found
 */
router.post('/', createTaskRules, permit('tasks:create'), async (req, res, next) => {
  try {
    const { title, description, projectId, assignedTo, priority, dueDate } = req.body;

    const project = await Project.findOne({
      _id: projectId,
      companyId: req.user.companyId,
    });
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found in your company' });
    }

    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, companyId: req.user.companyId });
      if (!assignee) {
        return res.status(404).json({ status: 'error', message: 'Assignee not found in your company' });
      }
    }

    const task = await Task.create({
      title,
      description,
      project: project._id,
      company: req.user.company,
      companyId: req.user.companyId,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      priority,
      dueDate,
    });

    await logActivity('TASK_CREATED', req.user, task, {
      description: `Task "${task.title}" created`,
    });

    if (assignedTo) {
      await logActivity('TASK_ASSIGNED', req.user, task, {
        description: `Task "${task.title}" assigned`,
        metadata: { assignedTo },
      });
      await notify.taskAssigned({ task, assignedToId: assignedTo, actor: req.user });
    }

    const populated = await task.populate(populateFields);
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update a task (MEMBER can only change status of assigned tasks)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       ADMIN/MANAGER can update all fields. MEMBER can only update the status
 *       of tasks assigned to them, following the allowed transition rules:
 *       - TODO -> IN_PROGRESS
 *       - IN_PROGRESS -> IN_REVIEW, TODO, BLOCKER
 *       - IN_REVIEW -> DONE, IN_PROGRESS, BLOCKER
 *       - DONE -> TODO
 *       - BLOCKER -> TODO, IN_PROGRESS (ADMIN/MANAGER only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               assignedTo:
 *                 type: string
 *                 nullable: true
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid status transition or member restriction
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.put('/:id', updateTaskRules, permit('tasks:update'), async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }

    if (req.user.role === 'MEMBER') {
      if (String(task.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ status: 'error', message: 'You can only update tasks assigned to you' });
      }
      if (req.body.status) {
        if (!isValidTransition(task.status, req.body.status)) {
          return res.status(400).json({
            status: 'error',
            message: `Invalid status transition: ${task.status} → ${req.body.status}. Allowed: ${STATUS_FLOW[task.status].join(', ')}`,
          });
        }
        if (task.status === 'BLOCKER') {
          return res.status(403).json({
            status: 'error',
            message: 'Only managers or admins can resolve blocked tasks',
          });
        }
        const oldStatus = task.status;
        task.status = req.body.status;

        if (task.status === 'DONE' && !task.completedAt) {
          task.completedAt = new Date();
        } else if (task.status !== 'DONE' && task.completedAt) {
          task.completedAt = null;
        }

        await task.save();

        await logActivity('TASK_STATUS_CHANGED', req.user, task, {
          description: `Status changed from ${oldStatus} to ${task.status}`,
          metadata: { from: oldStatus, to: task.status },
        });

        if (task.createdBy) {
          await notify.taskStatusChanged({
            task, oldStatus, newStatus: task.status, actor: req.user,
            notifyUserId: task.createdBy,
          });
        }

        const populated = await task.populate(populateFields);
        return res.json(populated);
      }
      return res.status(400).json({ status: 'error', message: 'Members can only update task status' });
    }

    // Admin / Manager — full update
    const { title, description, assignedTo, status, priority, dueDate } = req.body;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;

    if (status !== undefined && status !== task.status) {
      if (!isValidTransition(task.status, status)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid status transition: ${task.status} → ${status}. Allowed: ${STATUS_FLOW[task.status].join(', ')}`,
        });
      }
      const oldStatus = task.status;
      task.status = status;

      if (task.status === 'DONE' && !task.completedAt) {
        task.completedAt = new Date();
      } else if (task.status !== 'DONE' && task.completedAt) {
        task.completedAt = null;
      }

      await logActivity('TASK_STATUS_CHANGED', req.user, task, {
        description: `Status changed from ${oldStatus} to ${status}`,
        metadata: { from: oldStatus, to: status },
      });

      if (task.assignedTo) {
        await notify.taskStatusChanged({
          task, oldStatus, newStatus: status, actor: req.user,
          notifyUserId: task.assignedTo,
        });
      }
      if (task.createdBy && String(task.createdBy) !== String(task.assignedTo)) {
        await notify.taskStatusChanged({
          task, oldStatus, newStatus: status, actor: req.user,
          notifyUserId: task.createdBy,
        });
      }
    }

    if (assignedTo !== undefined && String(assignedTo) !== String(task.assignedTo)) {
      if (assignedTo) {
        const assignee = await User.findOne({ _id: assignedTo, companyId: req.user.companyId });
        if (!assignee) {
          return res.status(404).json({ status: 'error', message: 'Assignee not found in your company' });
        }
      }
      task.assignedTo = assignedTo || null;

      await logActivity('TASK_ASSIGNED', req.user, task, {
        description: `Task "${task.title}" reassigned`,
        metadata: { assignedTo: assignedTo || null },
      });
      if (assignedTo) {
        await notify.taskAssigned({ task, assignedToId: assignedTo, actor: req.user });
      }
    }

    await task.save();

    const populated = await task.populate(populateFields);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /tasks/{id}/assign:
 *   patch:
 *     summary: Assign or unassign a task (ADMIN, MANAGER)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 nullable: true
 *                 description: User ID to assign, or null to unassign
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Task or assignee not found
 */
router.patch('/:id/assign', assignTaskRules, permit('tasks:assign'), async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }

    const { assignedTo } = req.body;

    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, companyId: req.user.companyId });
      if (!assignee) {
        return res.status(404).json({ status: 'error', message: 'Assignee not found in your company' });
      }
    }

    task.assignedTo = assignedTo || null;
    await task.save();

    await logActivity('TASK_ASSIGNED', req.user, task, {
      description: `Task "${task.title}" ${assignedTo ? 'assigned' : 'unassigned'}`,
      metadata: { assignedTo: assignedTo || null },
    });

    if (assignedTo) {
      await notify.taskAssigned({ task, assignedToId: assignedTo, actor: req.user });
    }

    const populated = await task.populate(populateFields);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Soft delete a task (ADMIN, MANAGER)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.delete('/:id', taskIdParamRules, permit('tasks:delete'), async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }

    await task.softDelete();

    await logActivity('TASK_DELETED', req.user, task, {
      description: `Task "${task.title}" deleted`,
    });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
