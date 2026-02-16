const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');
const { protect } = require('../middleware/auth');
const { signupRules, loginRules } = require('../middleware/validate');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const toSlug = (name) =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

/**
 * @swagger
 * /auth/check-company:
 *   get:
 *     summary: Check if a company name is already registered
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: companyName
 *         schema:
 *           type: string
 *         description: Company name to check
 *         example: Acme Corp
 *     responses:
 *       200:
 *         description: Company existence check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 */
router.get('/check-company', async (req, res, next) => {
  try {
    const { companyName } = req.query;
    if (!companyName) {
      return res.json({ exists: false });
    }
    const slug = toSlug(companyName);
    const existing = await Company.findOne({ slug });
    res.json({ exists: !!existing });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user and create or join a company
 *     tags: [Auth]
 *     description: First user for a company becomes ADMIN. Subsequent users join as MEMBER or MANAGER.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, age, gender, designation, companyName]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 128
 *                 example: secret123
 *               age:
 *                 type: integer
 *                 minimum: 16
 *                 maximum: 100
 *                 example: 28
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               designation:
 *                 type: string
 *                 example: Software Engineer
 *               companyName:
 *                 type: string
 *                 maxLength: 100
 *                 example: Acme Corp
 *               role:
 *                 type: string
 *                 enum: [MANAGER, MEMBER]
 *                 description: Ignored for the first user (auto ADMIN)
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: User already exists or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/signup', signupRules, async (req, res, next) => {
  try {
    const { name, email, password, age, gender, designation, companyName, role: requestedRole } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ status: 'error', message: 'User already exists with this email' });
    }

    const slug = toSlug(companyName);

    // Find or create the Company document
    let company = await Company.findOne({ slug });
    let role;

    if (!company) {
      company = await Company.create({ name: companyName, slug });
      role = 'ADMIN';
    } else {
      role = ['MANAGER', 'MEMBER'].includes(requestedRole) ? requestedRole : 'MEMBER';
    }

    const user = await User.create({
      name,
      email,
      password,
      age,
      gender,
      designation,
      company: company._id,
      companyId: slug,
      role,
    });

    // Log activity (non-blocking)
    if (role === 'ADMIN') {
      ActivityLog.create({
        action: 'COMPANY_CREATED',
        description: `${user.name} created company "${company.name}"`,
        company: company._id,
        companyId: slug,
        performedBy: user._id,
        targetType: 'Company',
        targetId: company._id,
      }).catch((err) => logger.warn('Activity log failed', { error: err.message }));
    }

    ActivityLog.create({
      action: 'USER_JOINED',
      description: `${user.name} joined as ${role}`,
      company: company._id,
      companyId: slug,
      performedBy: user._id,
      targetType: 'User',
      targetId: user._id,
    }).catch((err) => logger.warn('Activity log failed', { error: err.message }));

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      designation: user.designation,
      companyName: company.name,
      companyId: slug,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and receive JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', loginRules, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('company', 'name slug');
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      designation: user.designation,
      companyName: user.company.name,
      companyId: user.companyId,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/User'
 *                 - type: object
 *                   properties:
 *                     companyName:
 *                       type: string
 *                       example: Acme Corp
 *       401:
 *         description: Not authenticated
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('company', 'name slug');
    const userData = user.toObject();
    userData.companyName = user.company?.name || '';
    res.json(userData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
