-- Audit log: records admin/seller mutations with before/after diffs.
-- Run manually in the Supabase SQL editor against the live DB.

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES user_profiles(id),
  actor_name  TEXT,
  action      TEXT NOT NULL,        -- e.g. 'user.create', 'user.delete', 'user.role_change'
  target_table TEXT NOT NULL,
  target_id   TEXT,
  before      JSONB,
  after       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT USING (get_my_role() = 'admin');

-- No INSERT/UPDATE/DELETE policy for regular roles — all writes go through
-- the service-role client from trusted server-side route handlers only.
