-- ============================================================
-- ACSM — Full Database Schema (single source of truth)
-- Run this in the Supabase SQL editor on a fresh project.
-- ============================================================

-- 1. Brands
CREATE TABLE brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Finishes
CREATE TABLE finishes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ceramic Types  (brand + size + finish + unit + price)
CREATE TABLE ceramic_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID REFERENCES brands(id) ON DELETE CASCADE,
  size             TEXT NOT NULL,
  finish_id        UUID REFERENCES finishes(id) ON DELETE CASCADE,
  measurement_unit TEXT NOT NULL DEFAULT 'm²'
                     CHECK (measurement_unit IN ('m²', 'm', 'pcs')),
  price_per_unit   NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand_id, size, finish_id)
);

-- 4. Ceramics
CREATE TABLE ceramics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  type_id      UUID REFERENCES ceramic_types(id) ON DELETE SET NULL,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 5. Stock Entries
-- Restock: new inventory arriving (direction is always 'add', no reason).
-- Adjustment: manual correction, either direction, always with a reason.
CREATE TABLE stock_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceramic_id UUID REFERENCES ceramics(id) ON DELETE CASCADE,
  quantity   NUMERIC NOT NULL CHECK (quantity > 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('Restock', 'Adjustment')),
  direction  TEXT NOT NULL DEFAULT 'add' CHECK (direction IN ('add', 'remove')),
  reason     TEXT CHECK (reason IN ('damaged', 'lost', 'miscount', 'other')),
  supplier   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (entry_type = 'Restock'    AND direction = 'add' AND reason IS NULL)
    OR
    (entry_type = 'Adjustment' AND reason IS NOT NULL)
  )
);

-- 6. Sales
-- sold_at is the actual moment of sale (client-supplied for offline mobile
-- sales synced later); created_at stays as the row-write/audit timestamp.
-- client_id is the mobile app's idempotency key — NULL for web-originated sales.
CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceramic_id    UUID REFERENCES ceramics(id) ON DELETE CASCADE,
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  price_at_sale NUMERIC NOT NULL,
  sold_by       UUID, -- FK to user_profiles(id) added below, once that table exists
  sold_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id     UUID UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 7. Inventory View
CREATE VIEW vw_ceramics_inventory AS
SELECT
  c.*,
  ct.brand_id                                                               AS brand_id,
  COALESCE(s_total.total_stock, 0)                                          AS initial_stock,
  COALESCE(sales_total.total_sold, 0)                                       AS sold_stock,
  (COALESCE(s_total.total_stock, 0) - COALESCE(sales_total.total_sold, 0)) AS current_stock,
  b.name                                                                    AS brand_name,
  ct.size,
  ct.measurement_unit,
  ct.price_per_unit,
  f.name                                                                    AS finish_name
FROM ceramics c
LEFT JOIN ceramic_types ct ON c.type_id   = ct.id
LEFT JOIN brands        b  ON ct.brand_id = b.id
LEFT JOIN finishes       f  ON ct.finish_id = f.id
LEFT JOIN (
  SELECT ceramic_id,
    SUM(
      CASE
        WHEN entry_type = 'Restock' THEN quantity
        WHEN entry_type = 'Adjustment' AND direction = 'add' THEN quantity
        WHEN entry_type = 'Adjustment' AND direction = 'remove' THEN -quantity
        ELSE 0
      END
    ) AS total_stock
  FROM stock_entries
  GROUP BY ceramic_id
) s_total     ON c.id = s_total.ceramic_id
LEFT JOIN (
  SELECT ceramic_id, SUM(quantity) AS total_sold
  FROM sales
  GROUP BY ceramic_id
) sales_total ON c.id = sales_total.ceramic_id;

-- Block oversell: a Sale can never exceed current_stock.
CREATE OR REPLACE FUNCTION public.check_sale_stock()
RETURNS TRIGGER AS $$
DECLARE
  available NUMERIC;
BEGIN
  SELECT current_stock INTO available FROM vw_ceramics_inventory WHERE id = NEW.ceramic_id;
  IF NEW.quantity > COALESCE(available, 0) THEN
    RAISE EXCEPTION 'Sale quantity (%) exceeds current stock (%)', NEW.quantity, COALESCE(available, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_sale_stock
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE PROCEDURE check_sale_stock();

-- 8. User Profiles
-- Roles: admin (full access), seller (record sales + view catalog/stock —
-- for the mobile sales-rep app), viewer (read-only).
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'seller', 'viewer')),
  locale     TEXT NOT NULL DEFAULT 'en-US',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales ADD CONSTRAINT sales_sold_by_fkey
  FOREIGN KEY (sold_by) REFERENCES user_profiles(id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 9. Orders — seller-submitted, admin-approved workflow.
-- An order sits 'pending' (no stock/sales impact) until an admin approves
-- (creates one `sales` row per item, deducting stock) or rejects it.
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
-- flip the order to 'approved'. If any item oversells, trg_check_sale_stock
-- raises and the whole approval rolls back (no partial approval).
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

-- Helper to read current user's role without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE finishes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceramic_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceramics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;

-- Finishes
CREATE POLICY "Public Read Finishes"  ON finishes FOR SELECT USING (true);
CREATE POLICY "Admin All Finishes"     ON finishes FOR ALL    USING (get_my_role() = 'admin');

-- Brands
CREATE POLICY "Public Read Brands"    ON brands   FOR SELECT USING (true);
CREATE POLICY "Admin All Brands"       ON brands   FOR ALL    USING (get_my_role() = 'admin');

-- Ceramic Types
CREATE POLICY "Public Read Types"     ON ceramic_types FOR SELECT USING (true);
CREATE POLICY "Admin All Types"        ON ceramic_types FOR ALL    USING (get_my_role() = 'admin');

-- Ceramics
CREATE POLICY "Public Read Ceramics"  ON ceramics FOR SELECT USING (true);
CREATE POLICY "Admin All Ceramics"     ON ceramics FOR ALL    USING (get_my_role() = 'admin');

-- Stock Entries
CREATE POLICY "Public Read Stock"     ON stock_entries FOR SELECT USING (true);
CREATE POLICY "Admin All StockEntries" ON stock_entries FOR ALL USING (get_my_role() = 'admin');

-- Sales
CREATE POLICY "Public Read Sales"      ON sales FOR SELECT USING (true);
CREATE POLICY "Admin All Sales"        ON sales FOR ALL USING (get_my_role() = 'admin');

-- User profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "Admins can update roles"
  ON user_profiles FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (role = get_my_role());

-- Orders — writes go through the service-role client in route handlers
-- (seller create, admin approve/reject), same convention as Sales.
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

-- Realtime — lets the admin dashboard subscribe to postgres_changes on orders.
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ============================================================
-- Seed data
-- ============================================================
INSERT INTO finishes (name) VALUES ('Normal'), ('Polished'), ('Decorative')
  ON CONFLICT DO NOTHING;
