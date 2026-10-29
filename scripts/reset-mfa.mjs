// Removes all two-step sign-in (TOTP) factors for one user — the recovery
// path for the admin, who can't be reset from the dashboard by anyone else.
//
//   node --env-file=.env scripts/reset-mfa.mjs someone@example.com
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The user sets
// up a new authenticator at their next web sign-in.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env scripts/reset-mfa.mjs <email>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

let user;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
if (error) throw error;
for (const factor of data.factors) {
  const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
    id: factor.id,
    userId: user.id,
  });
  if (deleteError) throw deleteError;
}
console.log(`Removed ${data.factors.length} factor(s) for ${email}.`);
