-- mSync: bank "money received" SMS forwarded from paired Android phones.
-- Self-contained by design (see MSYNC.md): msync_* tables, a tenant column on
-- every row, and no foreign keys into Kiln's tables, so the whole thing can
-- move to its own service later. Phones never touch these tables directly —
-- they call /api/msync/v1/* with a per-device key (service role writes).
-- Admins read them from the Kiln dashboard (aal2 is enforced there).

BEGIN;

CREATE TABLE msync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant TEXT NOT NULL,
  label TEXT NOT NULL,
  -- One-time pairing code (hashed) shown in the dashboard for a few minutes.
  pair_code_hash TEXT UNIQUE,
  pair_expires_at TIMESTAMPTZ,
  -- Long-lived device key (hashed); the phone keeps the plain key.
  token_hash TEXT UNIQUE,
  paired_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  app_version TEXT,
  queued INTEGER,
  revoked_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE msync_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant TEXT NOT NULL,
  device_id UUID REFERENCES msync_devices(id) ON DELETE SET NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,          -- when the phone got the SMS
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- sha256(sender + body): the same SMS from both phones, or a retried
  -- upload, is stored once.
  fingerprint TEXT NOT NULL,
  -- Filled by the server-side parser; 'unparsed' until a template matches.
  kind TEXT NOT NULL DEFAULT 'unparsed' CHECK (kind IN ('credit', 'other', 'unparsed')),
  bank TEXT,
  amount NUMERIC,
  currency TEXT,
  payer TEXT,
  reference TEXT,
  UNIQUE (tenant, fingerprint)
);

CREATE INDEX msync_messages_tenant_received_idx ON msync_messages (tenant, received_at DESC);
CREATE UNIQUE INDEX msync_messages_tenant_bank_ref_idx
  ON msync_messages (tenant, bank, reference) WHERE reference IS NOT NULL;

ALTER TABLE msync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE msync_messages ENABLE ROW LEVEL SECURITY;

-- Read-only for Kiln admins with two-step sign-in; all writes go through the
-- service role in lib/msync.
CREATE POLICY "Admins read msync devices" ON msync_devices FOR SELECT TO authenticated
USING ((SELECT get_my_role()) = 'admin' AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Admins read msync messages" ON msync_messages FOR SELECT TO authenticated
USING ((SELECT get_my_role()) = 'admin' AND (auth.jwt() ->> 'aal') = 'aal2');

-- Live list on the Payments page.
ALTER PUBLICATION supabase_realtime ADD TABLE msync_messages;

COMMIT;
