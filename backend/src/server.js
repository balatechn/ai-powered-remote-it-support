'use strict';
require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const { Server }  = require('socket.io');

const sequelize   = require('./config/database');
require('./models');                    // register models & associations
const logger      = require('./utils/logger');
const setupSocket = require('./websocket');

const authRoutes     = require('./routes/auth');
const deviceRoutes   = require('./routes/devices');
const commandRoutes  = require('./routes/commands');
const logRoutes      = require('./routes/logs');
const agentRoutes    = require('./routes/agent');
const downloadRoutes = require('./routes/downloads');

const app    = express();
app.set('trust proxy', 1);            // trust first proxy (Coolify/nginx)
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  pingInterval: 10000,
  pingTimeout:  5000
});
app.set('io', io);

// ── Middleware ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev', { stream: { write: m => logger.info(m.trim()) } }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/devices',  deviceRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/logs',     logRoutes);
app.use('/api/agent',    agentRoutes);
app.use('/downloads',    downloadRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: Math.floor(process.uptime()) }));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = parseInt(process.env.PORT || '4000');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database ready');
    setupSocket(io);
    server.listen(PORT, () => logger.info(`NexusIT backend on :${PORT}`));
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
})();
