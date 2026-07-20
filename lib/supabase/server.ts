import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies cannot be set.
            // Middleware handles refreshing the session.
          }
        },
      },
    }
  );
}

// Deliberately NOT @supabase/ssr's createServerClient: that variant restores
// the caller's browser session from cookies and uses it in place of the key
// it's given for the effective Authorization/RLS role — so a cookie-bearing
// admin request would silently run as that admin, not as service_role. Admin
// writes (and things like audit_logs with no INSERT policy for anyone else)
// depend on this actually being service_role, unconditionally.
export async function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
