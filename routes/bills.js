const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const multer      = require('multer');
const db          = require('../database');
const requireAuth = require('../auth-middleware');

const router = express.Router();

// ── Multer — save to uploads/notesheets/{siteId}/{month}.{ext} ────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'notesheets', String(req.params.siteId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.month}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────
function canAccess(user, siteId) {
  if (user.role === 'admin') return true;
  return !!db.prepare(
    'SELECT 1 FROM site_assignments WHERE user_id = ? AND site_id = ?'
  ).get(user.userId, siteId);
}

function transformBill(row) {
  if (!row) return null;
  return {
    site_id:       row.site_id,
    month_key:     row.month_key,
    billed:        row.billed,
    penalty:       row.penalty,
    net:           row.billed - row.penalty,
    status:        row.status,
    payment_mode:  row.payment_mode,
    remark:        row.remark,
    notesheet_url: row.notesheet_path
      ? `/uploads/notesheets/${row.notesheet_path}`
      : null,
    submitted_at:  row.submitted_at,
    verified_at:   row.verified_at,
    approved_at:   row.approved_at,
    paid_at:       row.paid_at,
    hold_since:    row.hold_since,
    updated_at:    row.updated_at
  };
}

/** Build an array of "YYYY-MM" keys for the last N months (newest last). */
function lastNMonthKeys(n) {
  const keys = [];
  const now  = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/bills?last_months=12
// Admin: all sites. Executive: assigned sites only.
router.get('/', requireAuth, (req, res) => {
  const n    = Math.min(parseInt(req.query.last_months) || 12, 24);
  const keys = lastNMonthKeys(n);
  const ph   = keys.map(() => '?').join(',');

  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(
      `SELECT * FROM bills WHERE month_key IN (${ph}) ORDER BY month_key, site_id`
    ).all(...keys);
  } else {
    rows = db.prepare(`
      SELECT b.* FROM bills b
      JOIN site_assignments sa ON sa.site_id = b.site_id AND sa.user_id = ?
      WHERE b.month_key IN (${ph})
      ORDER BY b.month_key, b.site_id
    `).all(req.user.userId, ...keys);
  }
  res.json(rows.map(transformBill));
});

// GET /api/bills/:siteId — full 12-month history for one site
router.get('/:siteId(\\d+)', requireAuth, (req, res) => {
  const siteId = parseInt(req.params.siteId);
  if (!canAccess(req.user, siteId))
    return res.status(403).json({ error: 'Access denied' });

  const keys = lastNMonthKeys(12);
  const ph   = keys.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM bills WHERE site_id = ? AND month_key IN (${ph}) ORDER BY month_key DESC`
  ).all(siteId, ...keys);
  res.json(rows.map(transformBill));
});

// GET /api/bills/:siteId/:month — single record
router.get('/:siteId(\\d+)/:month', requireAuth, (req, res) => {
  const siteId = parseInt(req.params.siteId);
  if (!canAccess(req.user, siteId))
    return res.status(403).json({ error: 'Access denied' });

  const row = db.prepare(
    'SELECT * FROM bills WHERE site_id = ? AND month_key = ?'
  ).get(siteId, req.params.month);
  res.json(row ? transformBill(row) : null);
});

// PUT /api/bills/:siteId/:month — upsert bill
router.put('/:siteId(\\d+)/:month', requireAuth, (req, res) => {
  const siteId = parseInt(req.params.siteId);
  const { month } = req.params;
  if (!canAccess(req.user, siteId))
    return res.status(403).json({ error: 'Access denied' });

  const {
    billed, penalty, status, payment_mode, remark,
    submitted_at, verified_at, approved_at, paid_at, hold_since
  } = req.body;

  if (!billed || billed <= 0)
    return res.status(400).json({ error: 'Billed amount must be greater than 0' });
  if ((penalty || 0) > billed)
    return res.status(400).json({ error: 'Penalty cannot exceed billed amount' });

  db.prepare(`
    INSERT INTO bills
      (site_id, month_key, billed, penalty, status, payment_mode, remark,
       submitted_at, verified_at, approved_at, paid_at, hold_since,
       updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(site_id, month_key) DO UPDATE SET
      billed        = excluded.billed,
      penalty       = excluded.penalty,
      status        = excluded.status,
      payment_mode  = excluded.payment_mode,
      remark        = excluded.remark,
      submitted_at  = excluded.submitted_at,
      verified_at   = excluded.verified_at,
      approved_at   = excluded.approved_at,
      paid_at       = excluded.paid_at,
      hold_since    = excluded.hold_since,
      updated_by    = excluded.updated_by,
      updated_at    = datetime('now')
  `).run(
    siteId, month,
    Math.round(billed), Math.round(penalty || 0),
    status || null, payment_mode || null, remark || null,
    submitted_at || null, verified_at || null,
    approved_at  || null, paid_at      || null,
    hold_since   || null,
    req.user.userId
  );

  const updated = db.prepare(
    'SELECT * FROM bills WHERE site_id = ? AND month_key = ?'
  ).get(siteId, month);
  res.json(transformBill(updated));
});

// POST /api/bills/:siteId/:month/notesheet — upload image file
router.post(
  '/:siteId(\\d+)/:month/notesheet',
  requireAuth,
  upload.single('notesheet'),
  (req, res) => {
    const siteId = parseInt(req.params.siteId);
    if (!canAccess(req.user, siteId))
      return res.status(403).json({ error: 'Access denied' });
    if (!req.file)
      return res.status(400).json({ error: 'No file uploaded' });

    const ext          = path.extname(req.file.originalname) || '.jpg';
    const relativePath = `${siteId}/${req.params.month}${ext}`;

    // Update only the notesheet_path — preserve all other bill fields
    db.prepare(`
      INSERT INTO bills (site_id, month_key, billed, penalty, notesheet_path, updated_at)
      VALUES (?, ?, 0, 0, ?, datetime('now'))
      ON CONFLICT(site_id, month_key) DO UPDATE SET
        notesheet_path = excluded.notesheet_path,
        updated_at     = datetime('now')
    `).run(siteId, req.params.month, relativePath);

    res.json({ url: `/uploads/notesheets/${relativePath}` });
  }
);

module.exports = router;
