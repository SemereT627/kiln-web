-- Add 'seller' as a valid user_profiles.role value.
-- Run manually in Supabase SQL editor.

ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'seller', 'viewer'));
