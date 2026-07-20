-- Admin negotiates final price at approval time, since ceramic prices are
-- listed but sales are often settled at a different negotiated price. Run
-- manually in the Supabase SQL editor.

-- Extend approve_order to accept optional per-item price overrides. Applied
-- inside the same transaction that locks the order row and inserts sales,
-- so there's no window for a concurrent reject/approve to race the update.
CREATE OR REPLACE FUNCTION public.approve_order(
  p_order_id UUID,
  p_admin_id UUID,
  p_price_overrides JSONB DEFAULT NULL -- [{ "orderItemId": "...", "priceAtSale": 123.45 }, ...]
)
RETURNS TABLE(sale_id UUID) AS $$
DECLARE
  item        RECORD;
  new_sale_id UUID;
  v_seller    UUID;
  v_price     NUMERIC;
BEGIN
  SELECT seller_id INTO v_seller
  FROM orders
  WHERE id = p_order_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % is not pending', p_order_id;
  END IF;

  FOR item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    v_price := item.price_at_sale;

    IF p_price_overrides IS NOT NULL THEN
      SELECT (o->>'priceAtSale')::NUMERIC INTO v_price
      FROM jsonb_array_elements(p_price_overrides) o
      WHERE (o->>'orderItemId')::UUID = item.id;

      IF v_price IS NULL THEN
        v_price := item.price_at_sale;
      END IF;
    END IF;

    IF v_price <= 0 THEN
      RAISE EXCEPTION 'Price at sale must be greater than 0 (order item %)', item.id;
    END IF;

    IF v_price <> item.price_at_sale THEN
      UPDATE order_items SET price_at_sale = v_price WHERE id = item.id;
    END IF;

    INSERT INTO sales (ceramic_id, quantity, price_at_sale, sold_by, sold_at)
    VALUES (item.ceramic_id, item.quantity, v_price, v_seller, now())
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
