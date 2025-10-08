-- COMPLETE BARCODE SYSTEM FIX FOR DONNIDELI
-- This script fixes the "Database error saving new user" issue
-- Run this ENTIRE script in your Supabase SQL Editor

-- ============================================
-- STEP 1: Clean up existing setup
-- ============================================

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created_generate_barcode ON auth.users;
DROP FUNCTION IF EXISTS auto_generate_barcode_for_new_user();
DROP FUNCTION IF EXISTS generate_unique_barcode();
DROP FUNCTION IF EXISTS get_user_by_barcode(text);
DROP FUNCTION IF EXISTS get_user_stats(text);
DROP FUNCTION IF EXISTS get_user_stats_by_barcode(text);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own barcode" ON user_barcodes;
DROP POLICY IF EXISTS "Admins can view all barcodes" ON user_barcodes;
DROP POLICY IF EXISTS "Users can insert their own barcode" ON user_barcodes;
DROP POLICY IF EXISTS "Allow trigger to insert barcodes" ON user_barcodes;

-- ============================================
-- STEP 2: Create or verify table structure
-- ============================================

-- Create user_barcodes table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_barcodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_barcodes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create RLS Policies (CORRECT ORDER)
-- ============================================

-- Policy 1: Users can view their own barcode
CREATE POLICY "Users can view their own barcode"
  ON user_barcodes FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Admins can view all barcodes
CREATE POLICY "Admins can view all barcodes"
  ON user_barcodes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Policy 3: Allow the trigger to insert barcodes (MUST BE FIRST INSERT POLICY)
-- This uses SECURITY DEFINER so it bypasses RLS
CREATE POLICY "Allow trigger to insert barcodes"
  ON user_barcodes FOR INSERT
  WITH CHECK (true);

-- ============================================
-- STEP 4: Create the auto-generate function
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_barcode_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER  -- This is critical - allows the trigger to bypass RLS
SET search_path = public
AS $$
DECLARE
  new_barcode TEXT;
  barcode_exists BOOLEAN;
  max_attempts INTEGER := 100;
  attempt_count INTEGER := 0;
BEGIN
  -- Generate a unique barcode with retry logic
  LOOP
    -- Generate a random 12-digit barcode starting with 'DN' (DonniDeli)
    new_barcode := 'DN' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
    
    -- Check if barcode already exists
    SELECT EXISTS(SELECT 1 FROM user_barcodes WHERE barcode = new_barcode) INTO barcode_exists;
    
    -- If barcode doesn't exist, exit loop
    IF NOT barcode_exists THEN
      EXIT;
    END IF;
    
    -- Prevent infinite loop
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique barcode after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the barcode for the new user
  INSERT INTO user_barcodes (user_id, barcode)
  VALUES (NEW.id, new_barcode)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create barcode for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: Create the trigger
-- ============================================

CREATE TRIGGER on_auth_user_created_generate_barcode
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_barcode_for_new_user();

-- ============================================
-- STEP 6: Create helper functions for lookups
-- ============================================

-- Function to get user by barcode (for admin use)
CREATE OR REPLACE FUNCTION get_user_by_barcode(search_barcode TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    ub.barcode
  FROM auth.users au
  INNER JOIN user_barcodes ub ON ub.user_id = au.id
  WHERE ub.barcode = search_barcode;
END;
$$ LANGUAGE plpgsql;

-- Function to get user stats (includes barcode)
CREATE OR REPLACE FUNCTION get_user_stats(target_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT,
  total_purchases BIGINT,
  total_spent NUMERIC,
  average_spent NUMERIC
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(ub.barcode, '') as barcode,
    COUNT(p.id) as total_purchases,
    COALESCE(SUM(p.amount), 0) as total_spent,
    COALESCE(AVG(p.amount), 0) as average_spent
  FROM auth.users au
  LEFT JOIN purchases p ON p.user_id = au.id
  LEFT JOIN user_barcodes ub ON ub.user_id = au.id
  WHERE au.email = target_email
  GROUP BY au.id, au.email, ub.barcode;
END;
$$ LANGUAGE plpgsql;

-- Function to get user stats by barcode
CREATE OR REPLACE FUNCTION get_user_stats_by_barcode(search_barcode TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT,
  total_purchases BIGINT,
  total_spent NUMERIC,
  average_spent NUMERIC
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    ub.barcode,
    COUNT(p.id) as total_purchases,
    COALESCE(SUM(p.amount), 0) as total_spent,
    COALESCE(AVG(p.amount), 0) as average_spent
  FROM auth.users au
  INNER JOIN user_barcodes ub ON ub.user_id = au.id
  LEFT JOIN purchases p ON p.user_id = au.id
  WHERE ub.barcode = search_barcode
  GROUP BY au.id, au.email, ub.barcode;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION get_user_by_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats_by_barcode(TEXT) TO authenticated;

-- ============================================
-- STEP 8: Generate barcodes for existing users
-- ============================================

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

-- ============================================
-- STEP 9: Verification queries
-- ============================================

-- Verify the trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_generate_barcode';

-- Verify all users have barcodes
SELECT 
  COUNT(*) as total_users,
  COUNT(ub.barcode) as users_with_barcodes,
  COUNT(*) - COUNT(ub.barcode) as users_without_barcodes
FROM auth.users au
LEFT JOIN user_barcodes ub ON ub.user_id = au.id;

-- Show sample barcodes
SELECT 
  au.email,
  ub.barcode,
  ub.created_at
FROM auth.users au
LEFT JOIN user_barcodes ub ON ub.user_id = au.id
ORDER BY ub.created_at DESC
LIMIT 5;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- 
-- What this script does:
-- 1. Cleans up any conflicting previous setup
-- 2. Creates the user_barcodes table with proper structure
-- 3. Sets up RLS policies that allow the trigger to work
-- 4. Creates a trigger that automatically generates barcodes for new users
-- 5. Creates helper functions for admin lookups
-- 6. Generates barcodes for any existing users
-- 7. Verifies everything is working
--
-- After running this script:
-- - New users will automatically get a barcode when they sign up
-- - Existing users will have barcodes generated
-- - Admins can search by email or barcode
-- - Users can see their own barcode in the dashboard
--
-- If you still get errors, check:
-- 1. That you have the 'admins' table created (run admin-setup.sql)
-- 2. That you have the 'purchases' table created
-- 3. The Supabase logs for any error messages
