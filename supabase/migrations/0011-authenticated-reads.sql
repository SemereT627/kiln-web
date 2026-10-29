-- Catalog, stock and sales tables were readable by anyone ("Public Read"
-- policies USING (true) with no role), so the public anon key shipped in
-- the browser bundle could read the whole inventory, prices and every
-- sale straight from PostgREST, bypassing the API. Reads now require a
-- signed-in user. The API routes also gate on requireUser() and forward
-- the mobile app's Bearer token, so web and mobile reads keep working.
-- Run manually in the Supabase SQL editor AFTER the web deploy and the
-- mobile update that sends its token on the catalog request are live.

BEGIN;

DROP POLICY "Public Read Finishes" ON finishes;
CREATE POLICY "Authenticated Read Finishes" ON finishes FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Brands" ON brands;
CREATE POLICY "Authenticated Read Brands" ON brands FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Types" ON ceramic_types;
CREATE POLICY "Authenticated Read Types" ON ceramic_types FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Ceramics" ON ceramics;
CREATE POLICY "Authenticated Read Ceramics" ON ceramics FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Stock" ON stock_entries;
CREATE POLICY "Authenticated Read Stock" ON stock_entries FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Sales" ON sales;
CREATE POLICY "Authenticated Read Sales" ON sales FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Returns" ON returns;
CREATE POLICY "Authenticated Read Returns" ON returns FOR
SELECT TO authenticated USING (true);

DROP POLICY "Public Read Return Items" ON return_items;
CREATE POLICY "Authenticated Read Return Items" ON return_items FOR
SELECT TO authenticated USING (true);

COMMIT;
