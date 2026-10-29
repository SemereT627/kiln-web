-- Two-step sign-in (TOTP) for the web dashboard. The proxy and API helpers
-- already require an aal2 session on the web; this enforces it in the
-- database too, so a password alone (an aal1 session) can't write data
-- even by calling PostgREST directly with the public anon key.
--
-- RESTRICTIVE policies are ANDed with the existing permissive ones, so the
-- current admin-only write rules still apply — this only adds "and the
-- session passed the authenticator step". Reads are untouched (the mobile
-- app reads at aal1). Seller writes go through API routes on the service
-- role, which bypasses RLS, so mobile sales/orders are unaffected.
-- Run manually in the Supabase SQL editor.

BEGIN;

CREATE POLICY "Writes need two-step sign-in (insert)" ON finishes AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON finishes AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON finishes AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON brands AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON brands AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON brands AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON ceramic_types AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON ceramic_types AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON ceramic_types AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON ceramics AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON ceramics AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON ceramics AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON stock_entries AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON stock_entries AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON stock_entries AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON sales AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON sales AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON sales AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON user_profiles AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON user_profiles AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON user_profiles AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON orders AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON orders AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON orders AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON order_items AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON order_items AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON order_items AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON returns AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON returns AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON returns AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON return_items AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON return_items AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON return_items AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON return_requests AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON return_requests AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON return_requests AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Writes need two-step sign-in (insert)" ON return_request_items AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (update)" ON return_request_items AS RESTRICTIVE FOR UPDATE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Writes need two-step sign-in (delete)" ON return_request_items AS RESTRICTIVE FOR DELETE
TO authenticated USING ((auth.jwt() ->> 'aal') = 'aal2');

COMMIT;
