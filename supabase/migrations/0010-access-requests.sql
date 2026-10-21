-- "Request access" used to be open self-signup: anyone could create an
-- account and land as a viewer with read access to the whole inventory.
-- It's now a real request that an admin approves or rejects; approval
-- creates the account and emails an invite link. Run manually in the
-- Supabase SQL editor, then turn OFF "Allow new users to sign up" under
-- Authentication → Sign In / Providers so the old path is closed too.

CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  role TEXT CHECK (role IN ('seller', 'viewer')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open request per address — repeat submissions are absorbed by the API.
CREATE UNIQUE INDEX access_requests_one_pending_per_email
  ON access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX access_requests_status_created_idx
  ON access_requests (status, created_at DESC);

-- Writes go through route handlers with the service-role client (public
-- submit, admin approve/reject), same convention as orders.
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all access requests" ON access_requests FOR ALL USING (get_my_role() = 'admin');
