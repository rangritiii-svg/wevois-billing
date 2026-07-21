-- WeVois Billing — Seed: 37 Sites
-- Run AFTER 01_schema.sql + 02_rls.sql

INSERT INTO sites (name, region) VALUES
  ('Jaipur – Malviya Nagar',  'Rajasthan'),
  ('Jaipur – Vaishali Nagar', 'Rajasthan'),
  ('Jodhpur – Zone 1',        'Rajasthan'),
  ('Jodhpur – Zone 2',        'Rajasthan'),
  ('Udaipur',                 'Rajasthan'),
  ('Kota',                    'Rajasthan'),
  ('Ajmer',                   'Rajasthan'),
  ('Bikaner',                 'Rajasthan'),
  ('Bhilwara',                'Rajasthan'),
  ('Alwar',                   'Rajasthan'),
  ('Sikar',                   'Rajasthan'),
  ('Pali',                    'Rajasthan'),
  ('Sri Ganganagar',          'Rajasthan'),
  ('Jhunjhunu',               'Rajasthan'),
  ('Bharatpur',               'Rajasthan'),
  ('Tonk',                    'Rajasthan'),
  ('Nagaur',                  'Rajasthan'),
  ('Chittorgarh',             'Rajasthan'),
  ('Banswara',                'Rajasthan'),
  ('Dungarpur',               'Rajasthan'),
  ('Indore',                  'Madhya Pradesh'),
  ('Bhopal',                  'Madhya Pradesh'),
  ('Ujjain',                  'Madhya Pradesh'),
  ('Gwalior',                 'Madhya Pradesh'),
  ('Jabalpur',                'Madhya Pradesh'),
  ('Ratlam',                  'Madhya Pradesh'),
  ('Dewas',                   'Madhya Pradesh'),
  ('Sagar',                   'Madhya Pradesh'),
  ('Rewa',                    'Madhya Pradesh'),
  ('Satna',                   'Madhya Pradesh'),
  ('Chhindwara',              'Madhya Pradesh'),
  ('Nagpur',                  'Maharashtra'),
  ('Nashik',                  'Maharashtra'),
  ('Aurangabad',              'Maharashtra'),
  ('Kolhapur',                'Maharashtra'),
  ('Solapur',                 'Maharashtra'),
  ('Amravati',                'Maharashtra')
ON CONFLICT DO NOTHING;


-- ── After creating users in Supabase Auth dashboard: ──────────────────────────
-- Run this block to set roles + assign sites.
-- Replace the email addresses with your actual user emails.

-- 1. Promote admin user (run after creating admin@wevois.com via Auth dashboard)
UPDATE user_profiles
SET full_name = 'Admin Manager', role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@wevois.com');

-- 2. Set executive name (run after creating suresh@wevois.com)
UPDATE user_profiles
SET full_name = 'Suresh Meena'
WHERE id = (SELECT id FROM auth.users WHERE email = 'suresh@wevois.com');

-- 3. Assign sites to Suresh → Jaipur × 2 + Tonk
INSERT INTO site_assignments (user_id, site_id)
SELECT u.id, s.id
FROM auth.users u, sites s
WHERE u.email = 'suresh@wevois.com'
  AND s.name IN ('Jaipur – Malviya Nagar', 'Jaipur – Vaishali Nagar', 'Tonk')
ON CONFLICT DO NOTHING;

-- 4. Assign sites to Ravi → Jodhpur × 2 + Udaipur (create ravi@wevois.com first)
INSERT INTO site_assignments (user_id, site_id)
SELECT u.id, s.id
FROM auth.users u, sites s
WHERE u.email = 'ravi@wevois.com'
  AND s.name IN ('Jodhpur – Zone 1', 'Jodhpur – Zone 2', 'Udaipur')
ON CONFLICT DO NOTHING;
