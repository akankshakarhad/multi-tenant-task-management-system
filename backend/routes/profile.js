const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const UserFeedback = require('../models/UserFeedback');
const UserGoal = require('../models/UserGoal');
const { protect, permit } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/:userId?', permit('profile:view'), async (req, res, next) => {
  try {
    const { companyId } = req.user;
    let targetUserId = req.user._id;

    if (req.params.userId) {
      if (
        req.user.role === 'MEMBER' &&
        String(req.params.userId) !== String(req.user._id)
      ) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
      targetUserId = new mongoose.Types.ObjectId(req.params.userId);
    }

    const user = await User.findOne({
      _id: targetUserId,
      companyId,
      isDeleted: false,
    }).select('name email designation role companyId createdAt');

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const userObjId = user._id;

    // Heatmap: daily activity counts for ~1 year (53 weeks)
    const heatmapStart = new Date();
    heatmapStart.setDate(heatmapStart.getDate() - 371);
    heatmapStart.setHours(0, 0, 0, 0);

    // Run all analytics queries in parallel
    const [
      tasksCompleted,
      onTimeAgg,
      activeProjects,
      totalContributions,
      activityHeatmap,
      goals,
      feedback,
      ratingAgg,
    ] = await Promise.all([
      // 1. Tasks completed
      Task.countDocuments({
        assignedTo: userObjId,
        companyId,
        status: 'DONE',
        isDeleted: false,
      }),

      // 2. On-time completion rate
      Task.aggregate([
        {
          $match: {
            assignedTo: userObjId,
            companyId,
            status: 'DONE',
            isDeleted: false,
            completedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            onTime: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$dueDate', null] },
                      { $lte: ['$completedAt', '$dueDate'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 3. Active projects count
      Project.countDocuments({
        members: userObjId,
        companyId,
        status: 'ACTIVE',
        isDeleted: false,
      }),

      // 4. Total contributions (activity log entries)
      ActivityLog.countDocuments({
        performedBy: userObjId,
        companyId,
      }),

      // 5. Activity heatmap (daily counts for ~26 weeks)
      ActivityLog.aggregate([
        {
          $match: {
            performedBy: userObjId,
            companyId,
            createdAt: { $gte: heatmapStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, date: '$_id', count: 1 } },
        { $sort: { date: 1 } },
      ]),

      // 6. Monthly goals
      UserGoal.find({
        user: userObjId,
        companyId,
        isDeleted: false,
      })
        .populate('project', 'name status')
        .sort({ month: -1 })
        .limit(12)
        .lean(),

      // 7. Feedback
      UserFeedback.find({
        targetUser: userObjId,
        companyId,
      })
        .populate('givenBy', 'name')
        .populate('project', 'name status')
        .sort({ createdAt: -1 })
        .lean(),

      // 8. Overall rating
      UserFeedback.aggregate([
        {
          $match: {
            targetUser: userObjId,
            companyId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Compute on-time rate
    const onTimeData = onTimeAgg[0];
    const onTimeCompletionRate =
      onTimeData && onTimeData.total > 0
        ? Math.round((onTimeData.onTime / onTimeData.total) * 100 * 10) / 10
        : 100;

    // Compute goal progress for each goal
    const monthlyGoals = await Promise.all(
      goals.map(async (goal) => {
        const monthStart = new Date(goal.month);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const completedCount = await Task.countDocuments({
          assignedTo: userObjId,
          project: goal.project?._id,
          companyId,
          status: 'DONE',
          isDeleted: false,
          completedAt: { $gte: monthStart, $lt: monthEnd },
        });

        return {
          _id: goal._id,
          project: goal.project,
          month: goal.month,
          targetCount: goal.targetCount,
          description: goal.description || '',
          completedCount,
          progress:
            goal.targetCount > 0
              ? Math.round((completedCount / goal.targetCount) * 100)
              : 0,
        };
      })
    );

    const ratingData = ratingAgg[0];
    const overallRating = ratingData
      ? Math.round(ratingData.avg * 10) / 10
      : null;

    // ── Per-project breakdown ──────────────────────────────
    const userProjects = await Project.find({
      members: userObjId,
      companyId,
      isDeleted: false,
    })
      .select('name status deadline createdAt')
      .lean();

    const projectIds = userProjects.map((p) => p._id);

    // Task stats per project for this user
    const perProjectTaskAgg = await Task.aggregate([
      {
        $match: {
          assignedTo: userObjId,
          project: { $in: projectIds },
          companyId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$project',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
          onTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'DONE'] },
                    { $ne: ['$completedAt', null] },
                    {
                      $or: [
                        { $eq: ['$dueDate', null] },
                        { $lte: ['$completedAt', '$dueDate'] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const taskStatsMap = {};
    perProjectTaskAgg.forEach((s) => {
      taskStatsMap[s._id.toString()] = {
        totalTasks: s.total,
        completedTasks: s.done,
        onTimeTasks: s.onTime,
      };
    });

    // Rating per project for this user
    const perProjectRatingAgg = await UserFeedback.aggregate([
      {
        $match: {
          targetUser: userObjId,
          companyId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$project',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingMap = {};
    perProjectRatingAgg.forEach((r) => {
      ratingMap[r._id.toString()] = {
        avgRating: Math.round(r.avgRating * 10) / 10,
        feedbackCount: r.count,
      };
    });

    // Combine into projectsBreakdown
    const projectsBreakdown = userProjects.map((proj) => {
      const pid = proj._id.toString();
      const stats = taskStatsMap[pid] || { totalTasks: 0, completedTasks: 0, onTimeTasks: 0 };
      const rating = ratingMap[pid] || { avgRating: null, feedbackCount: 0 };
      const projectFeedback = feedback.filter(
        (fb) => fb.project && fb.project._id.toString() === pid
      );

      return {
        _id: proj._id,
        name: proj.name,
        status: proj.status,
        deadline: proj.deadline,
        createdAt: proj.createdAt,
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        onTimeTasks: stats.onTimeTasks,
        completionRate: stats.totalTasks > 0
          ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
          : 0,
        avgRating: rating.avgRating,
        feedbackCount: rating.feedbackCount,
        feedback: projectFeedback,
      };
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: user.role,
        companyName: req.user.companyName || '',
        createdAt: user.createdAt,
      },
      analytics: {
        tasksCompleted,
        onTimeCompletionRate,
        activeProjects,
        totalContributions,
      },
      activityHeatmap,
      monthlyGoals,
      feedback,
      projectsBreakdown,
      overallRating,
      totalFeedbackCount: ratingData ? ratingData.count : 0,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
