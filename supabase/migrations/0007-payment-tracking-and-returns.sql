-- Payment collection trail for credit orders, plus partial returns on
-- already-approved orders. Run manually in the Supabase SQL editor.

-- 1. Payment collection trail: who marked a credit order paid, and when.
-- Cleared back to NULL whenever payment_status flips back to 'unpaid'.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES user_profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Stock entries gain a 'Return' type: goods physically came back, stock
-- goes back up. Shape mirrors Restock (always 'add', no reason) since a
-- return isn't a correction — it's a distinct, self-explanatory event.
ALTER TABLE stock_entries DROP CONSTRAINT IF EXISTS stock_entries_entry_type_check;
ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_entry_type_check
  CHECK (entry_type IN ('Restock', 'Adjustment', 'Return'));

ALTER TABLE stock_entries DROP CONSTRAINT IF EXISTS stock_entries_type_shape;
ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_type_shape
  CHECK (
    (entry_type = 'Restock'    AND direction = 'add' AND reason IS NULL)
    OR
    (entry_type = 'Return'     AND direction = 'add' AND reason IS NULL)
    OR
    (entry_type = 'Adjustment' AND reason IS NOT NULL)
  );

-- vw_ceramics_inventory already sums every stock_entries row not matched by
-- its CASE into 0 — a 'Return' row would silently vanish from stock. Add it
-- to the same 'add' bucket as Restock.
CREATE OR REPLACE VIEW vw_ceramics_inventory AS
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
        WHEN entry_type = 'Return' THEN quantity
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

-- 3. Returns: one or more line items from an already-approved order coming
-- back. Admin-recorded directly on web, no seller-request/approval cycle.
-- A `returns` row groups the event (who, when, optional notes); each
-- `return_items` row is one line item's returned quantity, capped at that
-- order_item's remaining (ordered - already returned) quantity.
CREATE TABLE returns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE return_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  stock_entry_id UUID REFERENCES stock_entries(id)
);

CREATE INDEX idx_returns_order_id ON returns (order_id);
CREATE INDEX idx_return_items_return_id ON return_items (return_id);
CREATE INDEX idx_return_items_order_item_id ON return_items (order_item_id);

-- Block over-returning: a line item can never have more returned against it
-- (across all return events) than was originally ordered.
CREATE OR REPLACE FUNCTION public.check_return_quantity()
RETURNS TRIGGER AS $$
DECLARE
  ordered   NUMERIC;
  returned  NUMERIC;
BEGIN
  SELECT quantity INTO ordered FROM order_items WHERE id = NEW.order_item_id;
  SELECT COALESCE(SUM(quantity), 0) INTO returned
  FROM return_items WHERE order_item_id = NEW.order_item_id;

  IF NEW.quantity > (ordered - returned) THEN
    RAISE EXCEPTION 'Return quantity (%) exceeds remaining returnable quantity (%)',
      NEW.quantity, (ordered - returned);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_return_quantity
  BEFORE INSERT ON return_items
  FOR EACH ROW EXECUTE PROCEDURE check_return_quantity();

-- Atomically record a return: for each {order_item_id, quantity}, add a
-- 'Return' stock_entries row (stock goes back up) and a return_items row
-- (trg_check_return_quantity caps it). Only approved orders are eligible —
-- a return only makes sense once a sale actually happened.
CREATE OR REPLACE FUNCTION public.record_return(
  p_order_id  UUID,
  p_admin_id  UUID,
  p_items     JSONB, -- [{ "orderItemId": "...", "quantity": 1 }, ...]
  p_notes     TEXT
)
RETURNS UUID AS $$
DECLARE
  v_status        TEXT;
  v_return_id     UUID;
  v_item          JSONB;
  v_order_item_id UUID;
  v_quantity      NUMERIC;
  v_ceramic_id    UUID;
  v_stock_entry_id UUID;
BEGIN
  SELECT status INTO v_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved orders can have returns recorded';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A return must include at least one item';
  END IF;

  INSERT INTO returns (order_id, created_by, notes)
  VALUES (p_order_id, p_admin_id, p_notes)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_order_item_id := (v_item->>'orderItemId')::UUID;
    v_quantity       := (v_item->>'quantity')::NUMERIC;

    SELECT ceramic_id INTO v_ceramic_id
    FROM order_items
    WHERE id = v_order_item_id AND order_id = p_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order item % does not belong to order %', v_order_item_id, p_order_id;
    END IF;

    INSERT INTO stock_entries (ceramic_id, quantity, entry_type, direction)
    VALUES (v_ceramic_id, v_quantity, 'Return', 'add')
    RETURNING id INTO v_stock_entry_id;

    INSERT INTO return_items (return_id, order_item_id, quantity, stock_entry_id)
    VALUES (v_return_id, v_order_item_id, v_quantity, v_stock_entry_id);
  END LOOP;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS — same convention as sales/stock_entries: public read, admin all.
-- Writes go through the service-role client in the returns route handler.
-- ============================================================

ALTER TABLE returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Returns"     ON returns      FOR SELECT USING (true);
CREATE POLICY "Admin All Returns"       ON returns      FOR ALL    USING (get_my_role() = 'admin');

CREATE POLICY "Public Read Return Items" ON return_items FOR SELECT USING (true);
CREATE POLICY "Admin All Return Items"   ON return_items FOR ALL    USING (get_my_role() = 'admin');
