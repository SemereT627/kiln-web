-- ============================================================
-- Migration: rework stock_entries, drop ceramics.brand_id,
-- require price_at_sale, block oversell, allow multiple admins.
-- Run manually in the Supabase SQL editor against the live DB.
-- See docs/adr/0001, 0002, 0003 for rationale.
-- ============================================================

-- 1. stock_entries: add direction/reason/supplier/notes, fold Initial into Restock
ALTER TABLE stock_entries
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'add',
  ADD COLUMN IF NOT EXISTS reason    TEXT,
  ADD COLUMN IF NOT EXISTS supplier  TEXT,
  ADD COLUMN IF NOT EXISTS notes     TEXT;

UPDATE stock_entries SET entry_type = 'Restock' WHERE entry_type = 'Initial';

-- Backfill any pre-existing negative quantities into the new add/remove model.
UPDATE stock_entries
SET quantity = -quantity, direction = 'remove', reason = 'other', entry_type = 'Adjustment'
WHERE quantity < 0;

ALTER TABLE stock_entries DROP CONSTRAINT IF EXISTS stock_entries_entry_type_check;
ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_entry_type_check
  CHECK (entry_type IN ('Restock', 'Adjustment'));

ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_direction_check
  CHECK (direction IN ('add', 'remove'));

ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_reason_check
  CHECK (reason IN ('damaged', 'lost', 'miscount', 'other'));

ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE stock_entries ADD CONSTRAINT stock_entries_type_shape
  CHECK (
    (entry_type = 'Restock'    AND direction = 'add' AND reason IS NULL)
    OR
    (entry_type = 'Adjustment' AND reason IS NOT NULL)
  );

-- 2. sales: require price_at_sale (backfill from the ceramic's current type price)
UPDATE sales s
SET price_at_sale = COALESCE(ct.price_per_unit, 0)
FROM ceramics c
JOIN ceramic_types ct ON ct.id = c.type_id
WHERE s.ceramic_id = c.id AND s.price_at_sale IS NULL;

UPDATE sales SET price_at_sale = 0 WHERE price_at_sale IS NULL;

ALTER TABLE sales ALTER COLUMN price_at_sale SET NOT NULL;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_quantity_positive;
ALTER TABLE sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0);

-- 3. Recreate the inventory view against the new stock formula and drop the
--    duplicated brand_id from ceramics (view now resolves brand via ceramic_types).
DROP VIEW IF EXISTS vw_ceramics_inventory;

ALTER TABLE ceramics DROP COLUMN IF EXISTS brand_id;

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

-- 4. Block oversell going forward
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

DROP TRIGGER IF EXISTS trg_check_sale_stock ON sales;
CREATE TRIGGER trg_check_sale_stock
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE PROCEDURE check_sale_stock();

-- 5. Allow multiple admins
DROP INDEX IF EXISTS one_admin_only;
