/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verify JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash', 'mfa_secret', 'refresh_token'] }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Role-Based Access Control middleware
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(`RBAC denied: User ${req.user.email} (${req.user.role}) tried accessing ${req.originalUrl}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Generate JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '15m' }
  );
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

module.exports = { authenticate, authorize, generateAccessToken, generateRefreshToken };
