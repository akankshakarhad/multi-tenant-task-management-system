const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');
const { protect, permit } = require('../middleware/auth');
const {
  createProjectRules,
  updateProjectRules,
  addMembersRules,
  projectIdParamRules,
  removeMemberRules,
} = require('../middleware/validate');

function logActivity(action, user, project, extra = {}) {
  return ActivityLog.create({
    action,
    description: extra.description || '',
    company: user.company,
    companyId: user.companyId,
    performedBy: user._id,
    targetType: 'Project',
    targetId: project._id,
    metadata: extra.metadata || undefined,
  }).catch((err) => logger.warn('Activity log failed', { error: err.message }));
}

const router = express.Router();

router.use(protect);

const populateFields = [
  { path: 'createdBy', select: 'name email' },
  { path: 'members', select: 'name email designation role' },
];

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List projects (MEMBER sees only assigned projects)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by project name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ARCHIVED, COMPLETED]
 *         description: Filter by status
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
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated list of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', permit('projects:list'), async (req, res, next) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.user.role === 'MEMBER') {
      filter.members = req.user._id;
    }

    if (req.query.search) {
      const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate(populateFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    res.json({
      data: projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 */
router.get('/:id', projectIdParamRules, permit('projects:read'), async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, companyId: req.user.companyId };
    if (req.user.role === 'MEMBER') {
      filter.members = req.user._id;
    }

    const project = await Project.findOne(filter).populate(populateFields);
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project (ADMIN, MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Website Redesign
 *               description:
 *                 type: string
 *                 example: Redesign the company website
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add as members
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       403:
 *         description: Not authorized
 */
router.post('/', createProjectRules, permit('projects:create'), async (req, res, next) => {
  try {
    const { name, description, members, deadline } = req.body;

    const memberSet = new Set((members || []).map(String));
    memberSet.add(String(req.user._id));

    const project = await Project.create({
      name,
      description,
      company: req.user.company,
      companyId: req.user.companyId,
      createdBy: req.user._id,
      members: [...memberSet],
      deadline: deadline || null,
    });

    const populated = await project.populate(populateFields);

    await logActivity('PROJECT_CREATED', req.user, project, {
      description: `${req.user.name} created project "${project.name}"`,
    });

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project (ADMIN, MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ARCHIVED, COMPLETED]
 *     responses:
 *       200:
 *         description: Updated project
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Project not found
 */
router.put('/:id', updateProjectRules, permit('projects:update'), async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    const { name, description, status, deadline } = req.body;
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (deadline !== undefined) project.deadline = deadline;

    await project.save();

    await logActivity('PROJECT_UPDATED', req.user, project, {
      description: `${req.user.name} updated project "${project.name}"`,
    });

    const populated = await project.populate(populateFields);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects/{id}/members:
 *   post:
 *     summary: Add members to a project (ADMIN, MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add
 *     responses:
 *       200:
 *         description: Updated project with new members
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Project not found
 */
router.post('/:id/members', addMembersRules, permit('projects:add-member'), async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    const { userIds } = req.body;

    const users = await User.find({
      _id: { $in: userIds },
      companyId: req.user.companyId,
    }).select('_id');

    const validIds = users.map((u) => String(u._id));
    const existing = new Set(project.members.map(String));

    let added = 0;
    for (const id of validIds) {
      if (!existing.has(id)) {
        project.members.push(new mongoose.Types.ObjectId(id));
        added++;
      }
    }

    if (added > 0) {
      await project.save();
      await logActivity('PROJECT_UPDATED', req.user, project, {
        description: `${req.user.name} added ${added} member(s) to project "${project.name}"`,
        metadata: { addedUserIds: validIds.filter((id) => !existing.has(id)) },
      });
    }

    const populated = await project.populate(populateFields);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a project (ADMIN, MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to remove
 *     responses:
 *       200:
 *         description: Updated project without the removed member
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Project or member not found
 */
router.delete('/:id/members/:userId', removeMemberRules, permit('projects:remove-member'), async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    const before = project.members.length;
    project.members = project.members.filter(
      (m) => String(m) !== req.params.userId
    );

    if (project.members.length === before) {
      return res.status(404).json({ status: 'error', message: 'User is not a member of this project' });
    }

    await project.save();

    await logActivity('PROJECT_UPDATED', req.user, project, {
      description: `${req.user.name} removed a member from project "${project.name}"`,
      metadata: { removedUserId: req.params.userId },
    });

    const populated = await project.populate(populateFields);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Soft delete a project (ADMIN, MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Project not found
 */
router.delete('/:id', projectIdParamRules, permit('projects:delete'), async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    await project.softDelete();

    await logActivity('PROJECT_DELETED', req.user, project, {
      description: `${req.user.name} deleted project "${project.name}"`,
    });

    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
