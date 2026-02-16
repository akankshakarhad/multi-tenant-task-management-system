const { body, param, query, validationResult } = require('express-validator');

/**
 * Run validation rules and return 400 with structured errors if any fail.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map((e) => e.msg),
    });
  }
  next();
};

// ── Auth ────────────────────────────────────────────────────

const signupRules = [
  body('companyName')
    .trim()
    .notEmpty().withMessage('Company name is required')
    .isLength({ max: 100 }).withMessage('Company name must be at most 100 characters'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
  body('age')
    .notEmpty().withMessage('Age is required')
    .isInt({ min: 16, max: 100 }).withMessage('Age must be between 16 and 100'),
  body('gender')
    .notEmpty().withMessage('Gender is required')
    .isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('designation')
    .trim()
    .notEmpty().withMessage('Designation is required')
    .isLength({ max: 100 }).withMessage('Designation must be at most 100 characters'),
  body('role')
    .optional()
    .isIn(['MANAGER', 'MEMBER']).withMessage('Role must be MANAGER or MEMBER'),
  handleValidation,
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidation,
];

// ── Users ───────────────────────────────────────────────────

const updateRoleRules = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['ADMIN', 'MANAGER', 'MEMBER']).withMessage('Invalid role'),
  handleValidation,
];

const userIdParamRules = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  handleValidation,
];

// ── Projects ────────────────────────────────────────────────

const createProjectRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required')
    .isLength({ max: 200 }).withMessage('Project name must be at most 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('members')
    .optional()
    .isArray().withMessage('Members must be an array'),
  body('members.*')
    .optional()
    .isMongoId().withMessage('Invalid member ID'),
  handleValidation,
];

const updateProjectRules = [
  param('id').isMongoId().withMessage('Invalid project ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Project name cannot be empty')
    .isLength({ max: 200 }).withMessage('Project name must be at most 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'ARCHIVED', 'COMPLETED']).withMessage('Invalid project status'),
  handleValidation,
];

const addMembersRules = [
  param('id').isMongoId().withMessage('Invalid project ID'),
  body('userIds')
    .isArray({ min: 1 }).withMessage('userIds array is required'),
  body('userIds.*')
    .isMongoId().withMessage('Invalid user ID in userIds'),
  handleValidation,
];

const projectIdParamRules = [
  param('id').isMongoId().withMessage('Invalid project ID'),
  handleValidation,
];

const removeMemberRules = [
  param('id').isMongoId().withMessage('Invalid project ID'),
  param('userId').isMongoId().withMessage('Invalid user ID'),
  handleValidation,
];

// ── Tasks ───────────────────────────────────────────────────

const createTaskRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ max: 300 }).withMessage('Title must be at most 300 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must be at most 5000 characters'),
  body('projectId')
    .notEmpty().withMessage('Project is required')
    .isMongoId().withMessage('Invalid project ID'),
  body('assignedTo')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('Invalid assignee ID'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('dueDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid due date format'),
  handleValidation,
];

const updateTaskRules = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 300 }).withMessage('Title must be at most 300 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must be at most 5000 characters'),
  body('status')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKER']).withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('assignedTo')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('Invalid assignee ID'),
  body('dueDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid due date format'),
  handleValidation,
];

const assignTaskRules = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('assignedTo')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('Invalid assignee ID'),
  handleValidation,
];

const taskIdParamRules = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  handleValidation,
];

// ── Comments ────────────────────────────────────────────────

const createCommentRules = [
  body('taskId')
    .notEmpty().withMessage('Task ID is required')
    .isMongoId().withMessage('Invalid task ID'),
  body('text')
    .trim()
    .notEmpty().withMessage('Comment text is required')
    .isLength({ max: 5000 }).withMessage('Comment must be at most 5000 characters'),
  handleValidation,
];

const commentTaskIdQueryRules = [
  query('taskId')
    .notEmpty().withMessage('taskId query parameter is required')
    .isMongoId().withMessage('Invalid task ID'),
  handleValidation,
];

const commentIdParamRules = [
  param('id').isMongoId().withMessage('Invalid comment ID'),
  handleValidation,
];

// ── Activity Logs ───────────────────────────────────────────

const activityLogQueryRules = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('skip')
    .optional()
    .isInt({ min: 0 }).withMessage('Skip must be >= 0'),
  query('action')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Action filter too long'),
  handleValidation,
];

module.exports = {
  signupRules,
  loginRules,
  updateRoleRules,
  userIdParamRules,
  createProjectRules,
  updateProjectRules,
  addMembersRules,
  projectIdParamRules,
  removeMemberRules,
  createTaskRules,
  updateTaskRules,
  assignTaskRules,
  taskIdParamRules,
  createCommentRules,
  commentTaskIdQueryRules,
  commentIdParamRules,
  activityLogQueryRules,
};
