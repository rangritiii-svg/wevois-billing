/**
 * WeVois Billing — Seed Script
 * CLI:    node seed.js
 * Module: require('./seed')()   ← called by server on first run
 *
 * Creates demo users, all 37 sites, site assignments,
 * and 12 months of realistic sample bills using the same
 * deterministic PRNG as the original prototype.
 */

const bcrypt = require('bcryptjs');
const db     = require('./database');

// ── PRNG (identical to original prototype) ────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rng(seed) {
  const f = mulberry32(seed);
  return {
    next:   f,
    int:    (lo, hi) => Math.floor(f() * (hi - lo + 1)) + lo,
    pick:   arr      => arr[Math.floor(f() * arr.length)],
    chance: p        => f() < p
  };
}

// ── Sites ─────────────────────────────────────────────────────────────────────
const SITE_DEFS = [
  ['Jaipur – Malviya Nagar','Rajasthan'],['Jaipur – Vaishali Nagar','Rajasthan'],
  ['Jodhpur – Zone 1','Rajasthan'],['Jodhpur – Zone 2','Rajasthan'],
  ['Udaipur','Rajasthan'],['Kota','Rajasthan'],['Ajmer','Rajasthan'],
  ['Bikaner','Rajasthan'],['Bhilwara','Rajasthan'],['Alwar','Rajasthan'],
  ['Sikar','Rajasthan'],['Pali','Rajasthan'],['Sri Ganganagar','Rajasthan'],
  ['Jhunjhunu','Rajasthan'],['Bharatpur','Rajasthan'],['Tonk','Rajasthan'],
  ['Nagaur','Rajasthan'],['Chittorgarh','Rajasthan'],['Banswara','Rajasthan'],
  ['Dungarpur','Rajasthan'],
  ['Indore','Madhya Pradesh'],['Bhopal','Madhya Pradesh'],['Ujjain','Madhya Pradesh'],
  ['Gwalior','Madhya Pradesh'],['Jabalpur','Madhya Pradesh'],['Ratlam','Madhya Pradesh'],
  ['Dewas','Madhya Pradesh'],['Sagar','Madhya Pradesh'],['Rewa','Madhya Pradesh'],
  ['Satna','Madhya Pradesh'],['Chhindwara','Madhya Pradesh'],
  ['Nagpur','Maharashtra'],['Nashik','Maharashtra'],['Aurangabad','Maharashtra'],
  ['Kolhapur','Maharashtra'],['Solapur','Maharashtra'],['Amravati','Maharashtra']
];

// ── Month helpers ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function buildMonths() {
  const now = new Date(); const arr = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` });
  }
  return arr;
}

const STAGES = ['Submitted','Verified','Approved','Paid'];
const DAY    = 86400000, HOUR = 3600000;
const NOW    = Date.now();

function submissionAnchor(mi, months) {
  const [y, mo] = months[mi].key.split('-').map(Number);
  const recency  = months.length - 1 - mi;
  return (recency === 0
    ? new Date(y, mo - 1, 1)
    : new Date(y, mo, 1)
  ).getTime();
}

function msToISO(ms) { return ms ? new Date(ms).toISOString() : null; }

// ── Main seed function ────────────────────────────────────────────────────────
function seed() {
  console.log('🗑  Clearing existing data…');
  db.exec('DELETE FROM bills');
  db.exec('DELETE FROM site_assignments');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM sites');

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('👤  Creating users…');
  const ROUNDS = 10;

  const adminResult = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (?, ?, 'Admin Manager', 'admin')
  `).run('admin@wevois.com', bcrypt.hashSync('admin123', ROUNDS));
  const adminId = Number(adminResult.lastInsertRowid);

  const sureshResult = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (?, ?, 'Suresh Meena', 'executive')
  `).run('suresh@wevois.com', bcrypt.hashSync('exec123', ROUNDS));
  const sureshId = Number(sureshResult.lastInsertRowid);

  const raviResult = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (?, ?, 'Ravi Sharma', 'executive')
  `).run('ravi@wevois.com', bcrypt.hashSync('exec123', ROUNDS));
  const raviId = Number(raviResult.lastInsertRowid);

  console.log(`   ✓ admin@wevois.com  (id=${adminId})`);
  console.log(`   ✓ suresh@wevois.com (id=${sureshId})`);
  console.log(`   ✓ ravi@wevois.com   (id=${raviId})`);

  // ── Sites ──────────────────────────────────────────────────────────────────
  console.log('🏗  Inserting 37 sites…');
  db.exec('BEGIN');
  try {
    const insertSite = db.prepare('INSERT INTO sites (id, name, region) VALUES (?, ?, ?)');
    SITE_DEFS.forEach(([name, region], i) => insertSite.run(i + 1, name, region));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  // ── Assignments ────────────────────────────────────────────────────────────
  // Suresh → Jaipur Malviya Nagar (1), Jaipur Vaishali Nagar (2), Tonk (16)
  // Ravi   → Jodhpur Zone 1 (3), Jodhpur Zone 2 (4), Udaipur (5)
  const insertAssign = db.prepare('INSERT INTO site_assignments (user_id, site_id) VALUES (?, ?)');
  [1, 2, 16].forEach(sid => insertAssign.run(sureshId, sid));
  [3, 4, 5].forEach(sid  => insertAssign.run(raviId,   sid));
  console.log('   ✓ Suresh → sites 1,2,16 | Ravi → sites 3,4,5');

  // ── Sample bills ───────────────────────────────────────────────────────────
  console.log('📋  Generating sample bills (37 sites × 12 months)…');
  const MONTHS = buildMonths();
  const bands  = [14, 18, 22, 28, 34, 42, 55, 70];
  const insertBill = db.prepare(`
    INSERT OR REPLACE INTO bills
      (site_id, month_key, billed, penalty, status, payment_mode,
       submitted_at, verified_at, approved_at, paid_at, hold_since)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    let count = 0;
    SITE_DEFS.forEach((_, siteIdx) => {
      const siteId = siteIdx + 1;
      const r      = rng(1000 + siteIdx * 97);
      const base   = r.pick(bands) * 100000;

      MONTHS.forEach((m, mi) => {
        const rr      = rng(7000 + siteIdx * 131 + mi * 17);
        const recency = MONTHS.length - 1 - mi;

        if (recency === 0 && rr.chance(0.19)) return;
        if (recency === 1 && rr.chance(0.08)) return;

        const wob    = 0.9 + rr.next() * 0.22;
        const billed = Math.round(base * wob / 1000) * 1000;
        let penalty  = 0;
        const roll   = rr.next();
        if      (roll < 0.34) penalty = 0;
        else if (roll < 0.85) penalty = Math.round(billed * (0.005 + rr.next() * 0.035) / 500) * 500;
        else                  penalty = Math.round(billed * (0.06  + rr.next() * 0.05)   / 500) * 500;

        let status;
        if      (recency === 0) status = rr.pick(['Submitted','Submitted','Verified','Verified','Approved']);
        else if (recency === 1) status = rr.pick(['Verified','Approved','Approved','Paid']);
        else if (recency === 2) status = rr.pick(['Approved','Paid','Paid']);
        else                    status = rr.pick(['Paid','Paid','Paid','Paid','Approved']);
        if (rr.chance(0.04)) status = 'On Hold';

        const reachedIdx = status === 'On Hold' ? rr.int(0, 1) : STAGES.indexOf(status);
        const dates      = {};
        const startDay   = recency === 0 ? rr.int(0, 14) : rr.int(0, 3);
        let t = submissionAnchor(mi, MONTHS) + startDay * DAY + rr.int(8, 18) * HOUR;
        const gaps = [[2,7],[3,10],[2,8]];
        for (let k = 0; k <= reachedIdx; k++) {
          if (k > 0) t += rr.int(gaps[k-1][0], gaps[k-1][1]) * DAY + rr.int(0, 9) * HOUR;
          dates[STAGES[k]] = t;
        }
        let prevT = 0;
        STAGES.forEach(k => {
          if (dates[k] == null) return;
          let v = Math.min(dates[k], NOW - HOUR);
          if (v <= prevT) v = prevT + HOUR;
          dates[k] = v; prevT = v;
        });

        const holdSince = status === 'On Hold' ? prevT : null;
        const mode      = status === 'Paid'
          ? rr.pick(['PFMS','PFMS','PFMS','PFMS','Treasury','Treasury','Cheque','Cheque','Self'])
          : null;

        insertBill.run(
          siteId, m.key, billed, penalty, status, mode,
          msToISO(dates.Submitted), msToISO(dates.Verified),
          msToISO(dates.Approved),  msToISO(dates.Paid),
          msToISO(holdSince)
        );
        count++;
      });
    });
    db.exec('COMMIT');
    console.log(`   ✓ Inserted ${count} bill records`);
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  console.log('\n✅  Seed complete!');
  console.log('   admin@wevois.com  / admin123  (all 37 sites)');
  console.log('   suresh@wevois.com / exec123   (Jaipur × 2, Tonk)');
  console.log('   ravi@wevois.com   / exec123   (Jodhpur × 2, Udaipur)\n');
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  seed();
  process.exit(0);
}

module.exports = seed;
