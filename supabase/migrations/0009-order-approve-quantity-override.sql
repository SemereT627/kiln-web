-- Admin sometimes needs to correct a seller-submitted quantity too (e.g. a
-- seller calls in a corrected m² value after submitting), not just price.
-- Extends the price-override mechanism from migration 0008 to also carry
-- quantity, in the same per-item override object. Run manually in the
-- Supabase SQL editor.

-- Postgres can't rename a parameter via CREATE OR REPLACE — drop first.
DROP FUNCTION IF EXISTS public.approve_order(UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.approve_order(
  p_order_id UUID,
  p_admin_id UUID,
  p_overrides JSONB DEFAULT NULL -- [{ "orderItemId": "...", "priceAtSale": 123.45, "quantity": 1.5 }, ...]
)
RETURNS TABLE(sale_id UUID) AS $$
DECLARE
  item        RECORD;
  new_sale_id UUID;
  v_seller    UUID;
  v_override  JSONB;
  v_price     NUMERIC;
  v_quantity  NUMERIC;
BEGIN
  SELECT seller_id INTO v_seller
  FROM orders
  WHERE id = p_order_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % is not pending', p_order_id;
  END IF;

  FOR item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    v_price    := item.price_at_sale;
    v_quantity := item.quantity;
    v_override := NULL;

    IF p_overrides IS NOT NULL THEN
      SELECT o INTO v_override
      FROM jsonb_array_elements(p_overrides) o
      WHERE (o->>'orderItemId')::UUID = item.id;

      IF v_override IS NOT NULL THEN
        IF v_override ? 'priceAtSale' THEN
          v_price := (v_override->>'priceAtSale')::NUMERIC;
        END IF;
        IF v_override ? 'quantity' THEN
          v_quantity := (v_override->>'quantity')::NUMERIC;
        END IF;
      END IF;
    END IF;

    IF v_price <= 0 THEN
      RAISE EXCEPTION 'Price at sale must be greater than 0 (order item %)', item.id;
    END IF;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than 0 (order item %)', item.id;
    END IF;

    IF v_price <> item.price_at_sale OR v_quantity <> item.quantity THEN
      UPDATE order_items SET price_at_sale = v_price, quantity = v_quantity WHERE id = item.id;
    END IF;

    INSERT INTO sales (ceramic_id, quantity, price_at_sale, sold_by, sold_at)
    VALUES (item.ceramic_id, v_quantity, v_price, v_seller, now())
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
