-- Barcode System Setup for DonniDeli
-- This adds unique barcodes to users for easy admin lookup
-- Run this SQL in your Supabase SQL Editor

-- Create user_barcodes table to store unique barcodes for each user
CREATE TABLE IF NOT EXISTS user_barcodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  barcode TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_barcodes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own barcode
CREATE POLICY "Users can view their own barcode"
  ON user_barcodes FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all barcodes
CREATE POLICY "Admins can view all barcodes"
  ON user_barcodes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Policy: Allow insert for authenticated users (for signup)
CREATE POLICY "Users can insert their own barcode"
  ON user_barcodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to generate a unique barcode
CREATE OR REPLACE FUNCTION generate_unique_barcode()
RETURNS TEXT AS $$
DECLARE
  new_barcode TEXT;
  barcode_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 12-digit barcode starting with 'DN' (DonniDeli)
    new_barcode := 'DN' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
    
    -- Check if barcode already exists
    SELECT EXISTS(SELECT 1 FROM user_barcodes WHERE barcode = new_barcode) INTO barcode_exists;
    
    -- If barcode doesn't exist, return it
    IF NOT barcode_exists THEN
      RETURN new_barcode;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_unique_barcode() TO authenticated;

-- Function to get user by barcode (for admin use)
CREATE OR REPLACE FUNCTION get_user_by_barcode(search_barcode TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  barcode TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    ub.barcode
  FROM auth.users au
  INNER JOIN user_barcodes ub ON ub.user_id = au.id
  WHERE ub.barcode = search_barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_by_barcode(TEXT) TO authenticated;

-- Update get_user_stats function to include barcode
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
    au.email,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user stats by barcode
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
    au.email,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats_by_barcode(TEXT) TO authenticated;

-- Generate barcodes for existing users (run this once)
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
