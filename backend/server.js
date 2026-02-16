const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const notificationService = require('./services/notificationService');
const emailService = require('./services/emailService');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

dotenv.config();

connectDB();

// Initialize email service (fails gracefully if SMTP not configured)
emailService.init();

const app = express();
const server = http.createServer(app);

// ── Trust proxy (required behind Render/Heroku/nginx) ──────
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Security headers ────────────────────────────────────────
app.use(helmet());

// ── Gzip compression ────────────────────────────────────────
app.use(compression());

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ── Body parsing with size limits ───────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── NoSQL injection prevention ──────────────────────────────
app.use(mongoSanitize());

// ── HTTP parameter pollution protection ─────────────────────
app.use(hpp());

// ── Rate limiting ───────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use(/\/api\/(?!auth)/, apiLimiter);

// ── Request logging (verbose in dev, minimal in prod) ───────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });
}

// ── Socket.io setup ─────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Authenticate socket connections via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join a room named after the user's ID for targeted notifications
  socket.join(socket.userId);

  socket.on('disconnect', () => {
    socket.leave(socket.userId);
  });
});

// Make io available to the notification service
notificationService.setIO(io);

// ── Swagger API Documentation ────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Task Manager API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activity-logs', require('./routes/activityLogs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/goals', require('./routes/goals'));

app.get('/', (req, res) => {
  res.json({ message: 'Multi-Tenant Task Management API' });
});

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Centralized error handler ───────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// ── Graceful shutdown ──────────────────────────────────────
const mongoose = require('mongoose');

const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
