// WeVois Billing — Database layer
// Uses the built-in node:sqlite module (Node.js 22.5+, stable in Node.js 24)
// Zero npm dependencies — no C++ compilation, no Visual Studio required.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'wevois.db'));

// Performance + safety
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    full_name     TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'executive'
                  CHECK(role IN ('executive','admin')),
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sites (
    id     INTEGER PRIMARY KEY,
    name   TEXT    NOT NULL,
    region TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_assignments (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
  );

  CREATE TABLE IF NOT EXISTS bills (
    site_id       INTEGER NOT NULL REFERENCES sites(id),
    month_key     TEXT    NOT NULL,
    billed        INTEGER NOT NULL DEFAULT 0,
    penalty       INTEGER NOT NULL DEFAULT 0,
    status        TEXT    CHECK(status IN
                    ('Submitted','Verified','Approved','Paid','On Hold')),
    payment_mode  TEXT    CHECK(payment_mode IN
                    ('Treasury','Self','PFMS','Cheque')),
    remark        TEXT,
    notesheet_path TEXT,
    submitted_at  TEXT,
    verified_at   TEXT,
    approved_at   TEXT,
    paid_at       TEXT,
    hold_since    TEXT,
    updated_by    INTEGER REFERENCES users(id),
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    PRIMARY KEY (site_id, month_key)
  );

  CREATE TRIGGER IF NOT EXISTS bills_updated_at
    AFTER UPDATE ON bills
    FOR EACH ROW
    BEGIN
      UPDATE bills SET updated_at = datetime('now')
      WHERE site_id = NEW.site_id AND month_key = NEW.month_key;
    END;
`);

// node:sqlite uses .prepare().get() / .all() / .run() just like better-sqlite3
module.exports = db;
