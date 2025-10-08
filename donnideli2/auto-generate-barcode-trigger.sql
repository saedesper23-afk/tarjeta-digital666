-- Auto-Generate Barcode Trigger for New Users
-- This will automatically create a barcode when a new user signs up
-- Run this SQL in your Supabase SQL Editor

-- 1. Create a function that generates a barcode for new users
CREATE OR REPLACE FUNCTION auto_generate_barcode_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_barcode TEXT;
  barcode_exists BOOLEAN;
BEGIN
  -- Generate a unique barcode
  LOOP
    -- Generate a random 12-digit barcode starting with 'DN' (DonniDeli)
    new_barcode := 'DN' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
    
    -- Check if barcode already exists
    SELECT EXISTS(SELECT 1 FROM user_barcodes WHERE barcode = new_barcode) INTO barcode_exists;
    
    -- If barcode doesn't exist, exit loop
    IF NOT barcode_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Insert the barcode for the new user
  INSERT INTO user_barcodes (user_id, barcode)
  VALUES (NEW.id, new_barcode)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_generate_barcode ON auth.users;

-- 3. Create the trigger that fires when a new user is created
CREATE TRIGGER on_auth_user_created_generate_barcode
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_barcode_for_new_user();

-- 4. Update the RLS policy to allow the trigger to insert barcodes
-- This is important because the trigger runs with the security definer privilege
ALTER TABLE user_barcodes ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert their own barcode" ON user_barcodes;
DROP POLICY IF EXISTS "Allow trigger to insert barcodes" ON user_barcodes;

-- Recreate insert policy to allow both users and the trigger
CREATE POLICY "Users can insert their own barcode"
  ON user_barcodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow inserts from the trigger (which runs as SECURITY DEFINER)
CREATE POLICY "Allow trigger to insert barcodes"
  ON user_barcodes FOR INSERT
  WITH CHECK (true);

-- 5. Test: Generate barcodes for any existing users without one
INSERT INTO user_barcodes (user_id, barcode)
SELECT 
  au.id,
  'DN' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_barcodes ub WHERE ub.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Verify the trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_generate_barcode';

-- 7. Verify all users have barcodes
SELECT 
  COUNT(*) as total_users,
  COUNT(ub.barcode) as users_with_barcodes,
  COUNT(*) - COUNT(ub.barcode) as users_without_barcodes
FROM auth.users au
LEFT JOIN user_barcodes ub ON ub.user_id = au.id;
