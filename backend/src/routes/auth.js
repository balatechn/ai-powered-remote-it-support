'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_change_me';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    if (!email || !password || !first_name || !last_name)
      return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const count = await User.count();
    const assignedRole = count === 0 ? 'admin' : (role || 'technician');

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password_hash, first_name, last_name, role: assignedRole });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    const refresh = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
    await user.update({ refresh_token: refresh });

    res.status(201).json({ token, refresh, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await user.update({ last_login: new Date() });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    const refresh = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
    await user.update({ refresh_token: refresh });

    res.json({ token, refresh, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const payload = jwt.verify(refresh, REFRESH_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user || user.refresh_token !== refresh)
      return res.status(401).json({ error: 'Invalid refresh token' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash', 'refresh_token'] } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
