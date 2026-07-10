import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the authenticated user for a request. Browser requests carry a
 * cookie session (handled by the shared server client); the mobile app has
 * no cookies and instead sends `Authorization: Bearer <access_token>`.
 */
async function getRequestUser(request?: Request): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const authHeader = request?.headers.get("authorization");
  const token = authHeader?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  const {
    data: { user: tokenUser },
  } = await supabase.auth.getUser(token);
  return tokenUser;
}

async function getRole(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role ?? null;
}

/** Admin-only routes (catalog management, user roles, etc). */
export async function requireAdmin(request?: Request): Promise<User | null> {
  const user = await getRequestUser(request);
  if (!user) return null;
  const role = await getRole(user.id);
  return role === "admin" ? user : null;
}

/** Sales-recording routes: admins and sales reps (mobile app + web). */
export async function requireSeller(request?: Request): Promise<User | null> {
  const user = await getRequestUser(request);
  if (!user) return null;
  const role = await getRole(user.id);
  return role === "admin" || role === "seller" ? user : null;
}
