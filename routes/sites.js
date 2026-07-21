const express     = require('express');
const db          = require('../database');
const requireAuth = require('../auth-middleware');

const router = express.Router();

// GET /api/sites
// Admin → all 37 sites
// Executive → only their assigned sites
router.get('/', requireAuth, (req, res) => {
  let sites;
  if (req.user.role === 'admin') {
    sites = db.prepare('SELECT * FROM sites ORDER BY region, name').all();
  } else {
    sites = db.prepare(`
      SELECT s.* FROM sites s
      JOIN site_assignments sa ON sa.site_id = s.id AND sa.user_id = ?
      ORDER BY s.region, s.name
    `).all(req.user.userId);
  }
  res.json(sites);
});

module.exports = router;
