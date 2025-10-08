-- Fix Admin Functions for DonniDeli
-- Run this SQL in your Supabase SQL Editor to fix the admin lookup functions
-- This will recreate the necessary functions with proper error handling

-- 0. Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS get_user_stats(TEXT);
DROP FUNCTION IF EXISTS get_user_stats_by_barcode(TEXT);

-- 1. Update get_user_stats function to include barcode and better error handling
CREATE OR REPLACE FUNCTION get_user_stats(target_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT,
  total_purchases BIGINT,
  total_spent NUMERIC,
  average_spent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(ub.barcode, '')::TEXT as barcode,
    COUNT(p.id)::BIGINT as total_purchases,
    COALESCE(SUM(p.amount), 0)::NUMERIC as total_spent,
    CASE 
      WHEN COUNT(p.id) > 0 THEN COALESCE(AVG(p.amount), 0)::NUMERIC
      ELSE 0::NUMERIC
    END as average_spent
  FROM auth.users au
  LEFT JOIN purchases p ON p.user_id = au.id
  LEFT JOIN user_barcodes ub ON ub.user_id = au.id
  WHERE LOWER(au.email) = LOWER(target_email)
  GROUP BY au.id, au.email, ub.barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats(TEXT) TO authenticated;

-- 2. Create/Update get_user_stats_by_barcode function
CREATE OR REPLACE FUNCTION get_user_stats_by_barcode(search_barcode TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT,
  total_purchases BIGINT,
  total_spent NUMERIC,
  average_spent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    ub.barcode::TEXT,
    COUNT(p.id)::BIGINT as total_purchases,
    COALESCE(SUM(p.amount), 0)::NUMERIC as total_spent,
    CASE 
      WHEN COUNT(p.id) > 0 THEN COALESCE(AVG(p.amount), 0)::NUMERIC
      ELSE 0::NUMERIC
    END as average_spent
  FROM auth.users au
  INNER JOIN user_barcodes ub ON ub.user_id = au.id
  LEFT JOIN purchases p ON p.user_id = au.id
  WHERE UPPER(ub.barcode) = UPPER(search_barcode)
  GROUP BY au.id, au.email, ub.barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats_by_barcode(TEXT) TO authenticated;

-- 3. Verify the functions were created successfully
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_user_stats', 'get_user_stats_by_barcode')
ORDER BY routine_name;

-- 4. Test the functions (optional - uncomment to test)
-- Replace 'test@example.com' with an actual user email
-- SELECT * FROM get_user_stats('test@example.com');

-- 5. Check if user_barcodes table exists and has data
SELECT 
  COUNT(*) as total_users_with_barcodes,
  MIN(created_at) as first_barcode_created,
  MAX(created_at) as last_barcode_created
FROM user_barcodes;
