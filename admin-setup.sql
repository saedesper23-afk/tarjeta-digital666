-- Admin System Setup for DonniDeli
-- Run this SQL in your Supabase SQL Editor after running the main setup

-- Create admins table to track which users are admins
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can check if they are an admin
CREATE POLICY "Users can check their own admin status"
  ON admins FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Only existing admins can add new admins
CREATE POLICY "Admins can add new admins"
  ON admins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- Update purchases table policies to allow admin access
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can insert their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can update their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can delete their own purchases" ON purchases;

-- Recreate policies with admin access
CREATE POLICY "Users and admins can view purchases"
  ON purchases FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Users and admins can insert purchases"
  ON purchases FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Users and admins can update purchases"
  ON purchases FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Users and admins can delete purchases"
  ON purchases FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Function to get user statistics (for admin use)
CREATE OR REPLACE FUNCTION get_user_stats(target_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  total_purchases BIGINT,
  total_spent NUMERIC,
  average_spent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    COUNT(p.id) as total_purchases,
    COALESCE(SUM(p.amount), 0) as total_spent,
    COALESCE(AVG(p.amount), 0) as average_spent
  FROM auth.users au
  LEFT JOIN purchases p ON p.user_id = au.id
  WHERE au.email = target_email
  GROUP BY au.id, au.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats(TEXT) TO authenticated;

-- IMPORTANT: Add your first admin user
-- Replace 'admin@example.com' with your admin email address
-- Run this AFTER you've created your admin account:
-- 
-- INSERT INTO admins (user_id)
-- SELECT id FROM auth.users WHERE email = 'admin@example.com';
