const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { protect, permit } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get dashboard summary and analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns summary stats, tasks grouped by status, user's open tasks,
 *       overdue tasks, and project progress. MEMBER role sees only their
 *       assigned tasks and projects they belong to.
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalTasks:
 *                       type: integer
 *                     totalProjects:
 *                       type: integer
 *                     overdue:
 *                       type: integer
 *                     myOpenTasks:
 *                       type: integer
 *                 tasksByStatus:
 *                   type: object
 *                   properties:
 *                     TODO:
 *                       type: integer
 *                     IN_PROGRESS:
 *                       type: integer
 *                     IN_REVIEW:
 *                       type: integer
 *                     DONE:
 *                       type: integer
 *                     BLOCKER:
 *                       type: integer
 *                 myTasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                   description: 10 most recent open tasks assigned to user
 *                 overdueTasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                   description: 10 most overdue tasks
 *                 projectProgress:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                       total:
 *                         type: integer
 *                       done:
 *                         type: integer
 *                       progress:
 *                         type: integer
 *                         description: Completion percentage (0-100)
 */
router.get('/', permit('dashboard:view'), async (req, res, next) => {
  try {
    const { companyId, _id: userId, role } = req.user;
    const now = new Date();

    const baseFilter = { companyId, isDeleted: false };

    const taskFilter = { ...baseFilter };
    if (role === 'MEMBER') {
      taskFilter.assignedTo = userId;
    }

    // 1. Tasks by status
    const statusAgg = await Task.aggregate([
      { $match: taskFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, BLOCKER: 0 };
    statusAgg.forEach((s) => { tasksByStatus[s._id] = s.count; });
    const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);

    // 2. My tasks
    const myTasks = await Task.find({
      ...baseFilter,
      assignedTo: userId,
      status: { $ne: 'DONE' },
    })
      .populate([
        { path: 'project', select: 'name' },
        { path: 'assignedTo', select: 'name' },
      ])
      .sort({ dueDate: 1, priority: -1, createdAt: -1 })
      .limit(10)
      .lean();

    // 3. Overdue tasks
    const overdueFilter = {
      ...taskFilter,
      dueDate: { $lt: now, $ne: null },
      status: { $ne: 'DONE' },
    };

    const overdueTasks = await Task.find(overdueFilter)
      .populate([
        { path: 'project', select: 'name' },
        { path: 'assignedTo', select: 'name email' },
      ])
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    const overdueCount = await Task.countDocuments(overdueFilter);

    // 4. Project progress
    const projectFilter = { ...baseFilter };
    if (role === 'MEMBER') {
      projectFilter.members = userId;
    }

    const projects = await Project.find(projectFilter)
      .select('name status')
      .lean();

    const projectIds = projects.map((p) => p._id);

    const projTaskAgg = await Task.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          isDeleted: false,
          companyId,
        },
      },
      {
        $group: {
          _id: { project: '$project', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const projMap = {};
    projects.forEach((p) => {
      projMap[p._id.toString()] = {
        _id: p._id,
        name: p.name,
        status: p.status,
        total: 0,
        done: 0,
      };
    });

    projTaskAgg.forEach((item) => {
      const key = item._id.project.toString();
      if (projMap[key]) {
        projMap[key].total += item.count;
        if (item._id.status === 'DONE') {
          projMap[key].done += item.count;
        }
      }
    });

    const projectProgress = Object.values(projMap).map((p) => ({
      ...p,
      progress: p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
    }));

    const projectCount = projects.length;

    res.json({
      summary: {
        totalTasks,
        totalProjects: projectCount,
        overdue: overdueCount,
        myOpenTasks: myTasks.length,
      },
      tasksByStatus,
      myTasks,
      overdueTasks,
      projectProgress,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
