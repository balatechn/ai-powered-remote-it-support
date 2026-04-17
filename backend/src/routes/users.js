/**
 * User Management Routes
 * Admin-only user CRUD with RBAC.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { z } = require('zod');

const router = express.Router();
router.use(authenticate);

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'technician', 'viewer']).optional()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'technician', 'viewer']).optional(),
  is_active: z.boolean().optional()
});

// ─── GET /api/users ──────────────────────────────────────────
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const { search, role, is_active, page = 1, limit = 50 } = req.query;
    const where = {};

    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash', 'mfa_secret', 'refresh_token'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── GET /api/users/:id ──────────────────────────────────────
router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash', 'mfa_secret', 'refresh_token'] }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── POST /api/users ─────────────────────────────────────────
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      email: data.email,
      password_hash,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role || 'technician'
    });

    logger.info(`User created: ${user.email} by ${req.user.email}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ─── PUT /api/users/:id ──────────────────────────────────────
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from deactivating themselves
    if (req.params.id === req.userId && data.is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await user.update(data);

    logger.info(`User updated: ${user.email} by ${req.user.email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── DELETE /api/users/:id ───────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Soft delete - deactivate instead of destroy
    await user.update({ is_active: false });

    logger.info(`User deactivated: ${user.email} by ${req.user.email}`);
    res.json({ message: 'User deactivated' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── PUT /api/users/:id/reset-password ───────────────────────
router.put('/:id/reset-password', authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    await user.update({ password_hash, refresh_token: null });

    logger.info(`Password reset for: ${user.email} by ${req.user.email}`);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
