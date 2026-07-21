-- WeVois Billing — Row Level Security
-- Run AFTER 01_schema.sql in Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;


-- ── user_profiles ─────────────────────────────────────────────────────────────
-- Every authenticated user can read all profiles (needed for role checks)
DROP POLICY IF EXISTS "profiles_read" ON user_profiles;
CREATE POLICY "profiles_read" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only update their own profile
DROP POLICY IF EXISTS "profiles_own_update" ON user_profiles;
CREATE POLICY "profiles_own_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());


-- ── sites ─────────────────────────────────────────────────────────────────────
-- Admin sees all sites
DROP POLICY IF EXISTS "sites_admin" ON sites;
CREATE POLICY "sites_admin" ON sites
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Executive sees only their assigned sites
DROP POLICY IF EXISTS "sites_exec" ON sites;
CREATE POLICY "sites_exec" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_assignments
      WHERE user_id = auth.uid() AND site_id = sites.id
    )
  );


-- ── site_assignments ──────────────────────────────────────────────────────────
-- Executives can see their own assignments
DROP POLICY IF EXISTS "assignments_own" ON site_assignments;
CREATE POLICY "assignments_own" ON site_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Admin can see all assignments
DROP POLICY IF EXISTS "assignments_admin" ON site_assignments;
CREATE POLICY "assignments_admin" ON site_assignments
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );


-- ── bills ─────────────────────────────────────────────────────────────────────
-- Admin: full access to all bills
DROP POLICY IF EXISTS "bills_admin_all" ON bills;
CREATE POLICY "bills_admin_all" ON bills
  FOR ALL USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Executive: read own assigned sites only
DROP POLICY IF EXISTS "bills_exec_read" ON bills;
CREATE POLICY "bills_exec_read" ON bills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_assignments
      WHERE user_id = auth.uid() AND site_id = bills.site_id
    )
  );

-- Executive: insert bills for own sites
DROP POLICY IF EXISTS "bills_exec_insert" ON bills;
CREATE POLICY "bills_exec_insert" ON bills
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM site_assignments
      WHERE user_id = auth.uid() AND site_id = bills.site_id
    )
  );

-- Executive: update bills for own sites
DROP POLICY IF EXISTS "bills_exec_update" ON bills;
CREATE POLICY "bills_exec_update" ON bills
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM site_assignments
      WHERE user_id = auth.uid() AND site_id = bills.site_id
    )
  );


-- ── Storage (notesheets bucket) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "notesheet_upload" ON storage.objects;
CREATE POLICY "notesheet_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'notesheets' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "notesheet_read" ON storage.objects;
CREATE POLICY "notesheet_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'notesheets' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "notesheet_update" ON storage.objects;
CREATE POLICY "notesheet_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'notesheets' AND auth.role() = 'authenticated'
  );
