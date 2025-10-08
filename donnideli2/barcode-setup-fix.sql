-- Fix for existing get_user_stats function
-- Run this FIRST, then run barcode-setup.sql

-- Drop the existing function to allow recreation with new signature
DROP FUNCTION IF EXISTS get_user_stats(text);
DROP FUNCTION IF EXISTS get_user_by_barcode(text);
DROP FUNCTION IF EXISTS get_user_stats_by_barcode(text);

-- Now you can run barcode-setup.sql
