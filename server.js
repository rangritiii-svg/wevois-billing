const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ── Uploads directory ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads', 'notesheets');
fs.mkdirSync(uploadsDir, { recursive: true });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Auto-seed on first run (no users = fresh DB) ──────────────────────────────
try {
  const db        = require('./database');
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (!userCount || userCount.cnt === 0) {
    console.log('🌱  Empty database — running seed with demo data…');
    require('./seed')();
  }
} catch (e) {
  console.error('⚠️  Seed check failed:', e.message);
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/*',     (req, res) => res.status(404).json({ error: 'API route not found' }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🌱  WeVois Billing — Server started');
  console.log('═'.repeat(46));
  console.log(`📊  Dashboard  → http://localhost:${PORT}/wevois-billing-dashboard.html`);
  console.log(`📱  Exec App   → http://localhost:${PORT}/wevois-billing-executive-app.html`);
  console.log('─'.repeat(46));
  console.log('👤  admin@wevois.com / admin123');
  console.log('👤  suresh@wevois.com / exec123');
  console.log('─'.repeat(46));
  console.log('Press Ctrl+C to stop\n');
});
