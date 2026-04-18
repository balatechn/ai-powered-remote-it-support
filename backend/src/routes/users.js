'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { User } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const SAFE = { exclude: ['password_hash', 'refresh_token'] };

// ── GET /api/users ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: SAFE,
      order: [['created_at', 'DESC']]
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users/me/change-password ─────────────────────
// Must be before /:id to avoid being swallowed by the param route
router.post('/me/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'current_password and new_password are required' });
    if (new_password.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await User.findByPk(req.user.id);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(new_password, 12);
    await user.update({ password_hash, refresh_token: null });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users ────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, first_name, last_name, username, role, is_active } = req.body;
    if (!email || !password || !first_name || !last_name)
      return res.status(400).json({ error: 'email, password, first_name and last_name are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email already in use' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      password_hash,
      first_name,
      last_name,
      username: username || email.split('@')[0],
      role: role || 'technician',
      is_active: is_active !== false,
    });

    const safe = await User.findByPk(user.id, { attributes: SAFE });
    res.status(201).json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/users/:id ─────────────────────────────────────
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { email, first_name, last_name, username, role, is_active, password } = req.body;

    // Prevent admin removing their own admin role
    if (req.params.id === req.user.id && role && role !== 'admin')
      return res.status(400).json({ error: 'You cannot change your own role' });

    const updates = {};
    if (email      !== undefined) updates.email      = email;
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name  !== undefined) updates.last_name  = last_name;
    if (username   !== undefined) updates.username   = username;
    if (role       !== undefined) updates.role       = role;
    if (is_active  !== undefined) updates.is_active  = is_active;
    if (password) {
      if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    await user.update(updates);
    const safe = await User.findByPk(user.id, { attributes: SAFE });
    res.json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/users/:id — soft delete (deactivate) ──────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'You cannot deactivate your own account' });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.update({ is_active: false });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users/:id/reset-password ────────────────────
router.post('/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const password_hash = await bcrypt.hash(password, 12);
    // Invalidate existing sessions by clearing refresh token
    await user.update({ password_hash, refresh_token: null });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

module.exports = router;
