-- Order approval workflow: sellers submit multi-item orders that sit
-- 'pending' (no stock/sales impact) until an admin approves or rejects.
-- Run manually in the Supabase SQL editor against the live DB.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS sold_by UUID REFERENCES user_profiles(id);

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES user_profiles(id),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'credit')),
  bank_account      TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid')),
  notes             TEXT,
  client_id         UUID UNIQUE,
  reviewed_by       UUID REFERENCES user_profiles(id),
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payment_method <> 'bank_transfer' OR bank_account IS NOT NULL)
);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ceramic_id    UUID NOT NULL REFERENCES ceramics(id),
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  price_at_sale NUMERIC NOT NULL,
  sale_id       UUID REFERENCES sales(id)
);

CREATE INDEX idx_orders_status_created_at ON orders (status, created_at DESC);
CREATE INDEX idx_orders_seller_id ON orders (seller_id);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

-- Keep updated_at current on any order mutation (status changes, admin edits).
CREATE OR REPLACE FUNCTION public.touch_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_touch_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE PROCEDURE touch_order_updated_at();

-- Atomically approve an order: insert one `sales` row per order item and
-- flip the order to 'approved'. Runs as a single transaction — the existing
-- trg_check_sale_stock oversell trigger fires per INSERT INTO sales, so if
-- any item oversells, the whole approval rolls back (no partial approval).
CREATE OR REPLACE FUNCTION public.approve_order(p_order_id UUID, p_admin_id UUID)
RETURNS TABLE(sale_id UUID) AS $$
DECLARE
  item       RECORD;
  new_sale_id UUID;
  v_seller   UUID;
BEGIN
  SELECT seller_id INTO v_seller
  FROM orders
  WHERE id = p_order_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % is not pending', p_order_id;
  END IF;

  FOR item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    INSERT INTO sales (ceramic_id, quantity, price_at_sale, sold_by, sold_at)
    VALUES (item.ceramic_id, item.quantity, item.price_at_sale, v_seller, now())
    RETURNING id INTO new_sale_id;

    UPDATE order_items SET sale_id = new_sale_id WHERE id = item.id;

    sale_id := new_sale_id;
    RETURN NEXT;
  END LOOP;

  UPDATE orders
  SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS — mirrors the `sales` convention: public/self read, admin all.
-- Actual writes (seller create, admin approve/reject) go through the
-- service-role client in server route handlers, same as `sales` does.
-- ============================================================

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can read own orders"
  ON orders FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Admin all orders"
  ON orders FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "Sellers can read own order items"
  ON order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.seller_id = auth.uid())
  );

CREATE POLICY "Admin all order items"
  ON order_items FOR ALL USING (get_my_role() = 'admin');

-- ============================================================
-- Realtime — lets the admin dashboard subscribe to postgres_changes.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
