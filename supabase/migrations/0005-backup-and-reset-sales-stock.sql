-- Backs up current sales + stock_entries, then wipes both so inventory can
-- restart from a fresh full physical count. IRREVERSIBLE for the live
-- `sales`/`stock_entries` tables — the backup tables below are the only way
-- back. Run manually in the Supabase SQL editor, step by step, only when
-- ready to actually reset. Review each backup table before running the
-- DELETEs.

-- 1. Backup — snapshot both tables as-is before touching anything.
CREATE TABLE sales_backup_20260711 AS SELECT * FROM sales;
CREATE TABLE stock_entries_backup_20260711 AS SELECT * FROM stock_entries;

-- Sanity check: row counts should match the live tables before proceeding.
-- SELECT count(*) FROM sales_backup_20260711;
-- SELECT count(*) FROM stock_entries_backup_20260711;

-- 2. Reset — wipe both so vw_ceramics_inventory.current_stock recomputes to
--    0 for every ceramic (initial_stock and sold_stock both derive from
--    these tables, nothing else to zero out).
DELETE FROM sales;
DELETE FROM stock_entries;

-- 3. Going forward: re-enter the physical count per ceramic as fresh
--    Restock entries via the Inventory page — that becomes the new
--    initial_stock baseline.
