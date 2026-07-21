-- WeVois Billing — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ── 1. User profiles (extends Supabase Auth) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'executive'
            CHECK(role IN ('executive','admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on every new sign-up (default role = executive)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    'executive'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 2. Sites ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL,
  region TEXT NOT NULL
);


-- ── 3. Site assignments (executive ↔ site) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_assignments (
  user_id UUID    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id)         ON DELETE CASCADE,
  PRIMARY KEY (user_id, site_id)
);


-- ── 4. Bills ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  site_id       INTEGER NOT NULL REFERENCES sites(id),
  month_key     CHAR(7) NOT NULL,          -- "YYYY-MM"

  billed        BIGINT NOT NULL DEFAULT 0,
  penalty       BIGINT NOT NULL DEFAULT 0,

  status        TEXT CHECK(status IN ('Submitted','Verified','Approved','Paid','On Hold')),
  payment_mode  TEXT CHECK(payment_mode IN ('Treasury','Self','PFMS','Cheque')),
  remark        VARCHAR(120),
  notesheet_path TEXT,                     -- Supabase Storage path

  submitted_at  TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  hold_since    TIMESTAMPTZ,

  updated_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (site_id, month_key)
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS bills_updated_at ON bills;
CREATE TRIGGER bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── 5. Supabase Storage bucket ────────────────────────────────────────────────
-- Run in SQL Editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('notesheets', 'notesheets', false)
ON CONFLICT (id) DO NOTHING;
