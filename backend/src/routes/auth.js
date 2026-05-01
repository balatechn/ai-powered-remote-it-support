/**
 * Authentication Routes
 * Handles login, register, refresh token, and logout.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authenticate, generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'technician', 'viewer']).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// ΓöÇΓöÇΓöÇ POST /api/auth/register ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      email: data.email,
      password_hash,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role || 'technician'
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    await user.update({ refresh_token: refreshToken });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/auth/login ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await User.findOne({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await user.update({ 
      refresh_token: refreshToken, 
      last_login: new Date() 
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar_url: user.avatar_url
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/auth/refresh ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
    const user = await User.findByPk(decoded.userId);

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    await user.update({ refresh_token: newRefreshToken });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/auth/logout ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/logout', authenticate, async (req, res) => {
  try {
    await User.update({ refresh_token: null }, { where: { id: req.userId } });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/auth/me ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
