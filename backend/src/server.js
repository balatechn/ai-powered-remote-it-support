/**
 * AI-Powered Remote IT Support Platform
 * Main Server Entry Point
 * 
 * Initializes Express, WebSocket, database, and all middleware.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const logger = require('./utils/logger');
const { initializeWebSocket } = require('./websocket');

// Route imports
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const sessionRoutes = require('./routes/sessions');
const scriptRoutes = require('./routes/scripts');
const aiRoutes = require('./routes/ai');
const logRoutes = require('./routes/logs');
const agentRoutes = require('./routes/agent');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');

const app = express();
app.set('trust proxy', 1); // Trust nginx proxy for rate-limiting & IP headers
const server = http.createServer(app);

// WebSocket setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Global Middleware ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // Allow inline styles for dashboard
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' }
});
app.use('/api/auth/', authLimiter);

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Global Error Handler ────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ─── Initialize WebSocket ────────────────────────────────────
initializeWebSocket(io);

// Make io accessible to routes
app.set('io', io);

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function startServer() {
  // Listen immediately so the container never crashes due to DB delay
  await new Promise((resolve, reject) => {
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      resolve();
    });
    server.on('error', reject);
  });

  // Connect to DB and sync schema in the background (retrying indefinitely)
  const connectDB = async () => {
    let retries = 20;
    while (retries > 0) {
      try {
        await sequelize.authenticate();
        logger.info('✅ Database connection established');
        await sequelize.sync({ alter: false });
        logger.info('✅ Database models synchronized');
        return;
      } catch (err) {
        retries--;
        logger.warn(`DB not ready, retrying in 5s... (${retries} left): ${err.message}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    logger.error('❌ Could not connect to database after all retries — routes may fail');
  };

  connectDB();
}

// Catch any unhandled rejections / uncaught exceptions so the process doesn't crash silently
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

module.exports = { app, server, io };
