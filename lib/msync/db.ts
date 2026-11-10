import { createClient } from "@supabase/supabase-js";

/** Service-role client owned by mSync (bypasses RLS). Deliberately not Kiln's
 * lib/supabase helper: lib/msync must import nothing from the host app. */
export function msyncDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
