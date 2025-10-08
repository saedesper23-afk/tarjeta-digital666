-- Fix Barcode Display Issue for DonniDeli
-- Run this SQL in your Supabase SQL Editor to diagnose and fix barcode display issues

-- 1. Check if user_barcodes table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_barcodes'
) as table_exists;

-- 2. Check how many users have barcodes
SELECT 
  COUNT(*) as total_users,
  COUNT(ub.barcode) as users_with_barcodes,
  COUNT(*) - COUNT(ub.barcode) as users_without_barcodes
FROM auth.users au
LEFT JOIN user_barcodes ub ON ub.user_id = au.id;

-- 3. Check RLS policies on user_barcodes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_barcodes';

-- 4. Generate barcodes for users who don't have one
-- This will create barcodes for all existing users who don't have one
INSERT INTO user_barcodes (user_id, barcode)
SELECT 
  au.id,
  'DN' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_barcodes ub WHERE ub.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Verify all users now have barcodes
SELECT 
  au.email,
  ub.barcode,
  ub.created_at
FROM auth.users au
LEFT JOIN user_barcodes ub ON ub.user_id = au.id
ORDER BY au.created_at DESC
LIMIT 10;

-- 6. Update RLS policies to ensure users can see their own barcode
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own barcode" ON user_barcodes;
DROP POLICY IF EXISTS "Admins can view all barcodes" ON user_barcodes;
DROP POLICY IF EXISTS "Users can insert their own barcode" ON user_barcodes;

-- Recreate policies with better permissions
CREATE POLICY "Users can view their own barcode"
  ON user_barcodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all barcodes"
  ON user_barcodes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own barcode"
  ON user_barcodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. Ensure RLS is enabled
ALTER TABLE user_barcodes ENABLE ROW LEVEL SECURITY;

-- 8. Final verification - show sample of users with barcodes
SELECT 
  'Total users with barcodes:' as status,
  COUNT(*) as count
FROM user_barcodes;
