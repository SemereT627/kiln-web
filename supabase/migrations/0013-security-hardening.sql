-- Security hardening (Nov 2026 review).
--
-- 1. Sale prices must be positive. The API already validates them; this
--    stops a bad price reaching the ledger by any other path.
-- 2. Admin-only tables (access requests, audit log, other users' profiles)
--    can only be read by a session that passed the authenticator step
--    (aal2). Before this a stolen admin password alone (aal1) could read
--    them straight from PostgREST. A user can still read their own profile
--    at aal1 (the mobile app does). Shared business data (sales, stock,
--    catalog) stays readable at aal1 because the mobile app has no 2FA yet.
-- 3. "Users can update own profile" also checks the row id, so a user
--    can't move their own profile to a different id.
-- 4. Pin get_sales_day_summary's search_path (Supabase advisor 0011).

BEGIN;

ALTER TABLE sales ADD CONSTRAINT sales_price_at_sale_positive CHECK (price_at_sale > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_price_at_sale_positive CHECK (price_at_sale > 0);

CREATE POLICY "Reads need two-step sign-in" ON access_requests AS RESTRICTIVE FOR SELECT
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Reads need two-step sign-in" ON audit_logs AS RESTRICTIVE FOR SELECT
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Other profiles need two-step sign-in" ON user_profiles AS RESTRICTIVE FOR SELECT
TO authenticated USING (id = auth.uid() OR (auth.jwt() ->> 'aal') = 'aal2');

ALTER POLICY "Users can update own profile" ON user_profiles
  WITH CHECK (id = auth.uid() AND role = get_my_role());

ALTER FUNCTION get_sales_day_summary(timestamptz, timestamptz, integer, integer)
  SET search_path = public;

COMMIT;
