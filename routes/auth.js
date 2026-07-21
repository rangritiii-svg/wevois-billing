const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../database');
const { JWT_SECRET } = require('../auth-middleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });

  const assignedSiteIds = db
    .prepare('SELECT site_id FROM site_assignments WHERE user_id = ?')
    .all(user.id)
    .map(r => r.site_id);

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id:              user.id,
      email:           user.email,
      fullName:        user.full_name,
      role:            user.role,
      assignedSiteIds
    }
  });
});

// GET /api/auth/me  — validate token & return profile
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = db.prepare(
      'SELECT id, email, full_name, role FROM users WHERE id = ?'
    ).get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const assignedSiteIds = db
      .prepare('SELECT site_id FROM site_assignments WHERE user_id = ?')
      .all(user.id)
      .map(r => r.site_id);

    res.json({
      id:              user.id,
      email:           user.email,
      fullName:        user.full_name,
      role:            user.role,
      assignedSiteIds
    });
  } catch {
    res.status(401).json({ error: 'Session expired — please sign in again' });
  }
});

module.exports = router;
