-- Sellers only read what the app needs: the catalog with current stock, and
-- their own sales, orders and returns. Admins and viewers still read
-- everything. Before this any signed-in seller (password only, no 2FA) could
-- read every sale, return and stock movement straight from PostgREST.
--
-- vw_ceramics_inventory now runs as its owner (security_invoker off) so the
-- stock totals stay correct for sellers without exposing the sales and
-- stock_entries rows behind them. It only returns catalog columns and
-- per-product totals, and is granted to signed-in users only, read-only.
-- (Supabase's linter flags security-definer views; this one is deliberate.)

BEGIN;

ALTER VIEW vw_ceramics_inventory SET (security_invoker = false);
REVOKE ALL ON vw_ceramics_inventory FROM anon, authenticated;
GRANT SELECT ON vw_ceramics_inventory TO authenticated;

DROP POLICY "Authenticated Read Sales" ON sales;
CREATE POLICY "Read sales: viewers, or own sales" ON sales FOR SELECT TO authenticated
USING (
  (SELECT get_my_role()) = 'viewer'
  OR sold_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.sale_id = sales.id AND o.seller_id = (SELECT auth.uid())
  )
);

DROP POLICY "Authenticated Read Stock" ON stock_entries;
CREATE POLICY "Read stock entries: viewers" ON stock_entries FOR SELECT TO authenticated
USING ((SELECT get_my_role()) = 'viewer');

DROP POLICY "Authenticated Read Returns" ON returns;
CREATE POLICY "Read returns: viewers, or own orders" ON returns FOR SELECT TO authenticated
USING (
  (SELECT get_my_role()) = 'viewer'
  OR EXISTS (SELECT 1 FROM orders o WHERE o.id = returns.order_id AND o.seller_id = (SELECT auth.uid()))
);

DROP POLICY "Authenticated Read Return Items" ON return_items;
CREATE POLICY "Read return items: viewers, or own orders" ON return_items FOR SELECT TO authenticated
USING (
  (SELECT get_my_role()) = 'viewer'
  OR EXISTS (
    SELECT 1 FROM returns r JOIN orders o ON o.id = r.order_id
    WHERE r.id = return_items.return_id AND o.seller_id = (SELECT auth.uid())
  )
);

COMMIT;
