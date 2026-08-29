import { createClient, createServiceClient } from "@/lib/supabase/server";
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
    error,
  } = await supabase.auth.getUser(token);
  if (error) console.error("getRequestUser: token auth failed", error);
  return tokenUser;
}

/** Looks up a user's role directly via service role — no session/cookie
 * dependency, so this is also safe to call from middleware.ts. */
export async function getRole(userId: string): Promise<string | null> {
  const supabase = await createServiceClient();
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

/** Sales-recording routes: admins and sales reps (mobile app + web).
 * The resolved role is attached to the returned user (as `.role`) so
 * callers that need it — e.g. to tell an admin's view of orders from a
 * seller's — don't have to re-query user_profiles themselves. */
export async function requireSeller(
  request?: Request,
): Promise<(User & { role: string }) | null> {
  const user = await getRequestUser(request);
  if (!user) {
    console.error("requireSeller: no user resolved from request");
    return null;
  }
  const role = await getRole(user.id);
  if (role !== "admin" && role !== "seller") {
    console.error("requireSeller: wrong role", user.id, role);
    return null;
  }
  return { ...user, role };
}
