// Legacy re-export — prefer importing from @/lib/supabase/server in API routes
export { createClient as createServerSupabase } from "@/lib/supabase/server";
export { createClient as createBrowserSupabase } from "@/lib/supabase/client";
