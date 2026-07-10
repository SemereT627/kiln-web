-- Add sold_at (client-supplied sale timestamp, for offline mobile sales
-- synced later) and client_id (mobile idempotency key) to sales.
-- Run manually in the Supabase SQL editor against the live DB.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sold_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;

-- Backfill sold_at for existing rows from created_at.
UPDATE sales SET sold_at = created_at WHERE sold_at IS NULL;
