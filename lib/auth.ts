import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the authenticated user for a request. Browser requests carry a
 * cookie session (handled by the shared server client); the mobile app has
 * no cookies and instead sends `Authorization: Bearer <access_token>`.
 */
type Aal = "aal1" | "aal2";

interface RequestIdentity {
  user: User;
  /** Assurance level of the session: aal2 once an authenticator code was verified. */
  aal: Aal;
  /** true for the mobile app (Bearer token), false for the web (cookie session). */
  viaBearer: boolean;
}

/** Reads the `aal` claim from a JWT that getUser() has already validated. */
function aalFromToken(token: string | undefined): Aal {
  try {
    const payload = JSON.parse(
      Buffer.from(token!.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

async function getRequestIdentity(request?: Request): Promise<RequestIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return { user, aal: aalFromToken(session?.access_token), viaBearer: false };
  }

  const authHeader = request?.headers.get("authorization");
  const token = authHeader?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  const {
    data: { user: tokenUser },
    error,
  } = await supabase.auth.getUser(token);
  if (error) console.error("getRequestIdentity: token auth failed", error);
  return tokenUser ? { user: tokenUser, aal: aalFromToken(token), viaBearer: true } : null;
}

/**
 * Web sessions must have passed the authenticator-code step (aal2) — the
 * proxy enforces it for pages, this enforces it for API calls. The mobile
 * app has no second step yet, so Bearer requests from non-admins are
 * accepted at aal1. Admin actions always require aal2, on any channel.
 */
function meetsAssurance(identity: RequestIdentity, role: string | null) {
  if (identity.aal === "aal2") return true;
  return identity.viaBearer && role !== "admin";
}

async function getRequestUser(request?: Request): Promise<User | null> {
  const identity = await getRequestIdentity(request);
  if (!identity) return null;
  const role = await getRole(identity.user.id);
  return meetsAssurance(identity, role) ? identity.user : null;
}

/** Looks up a user's role directly via service role — no session/cookie
 * dependency, so this is also safe to call from proxy.ts. */
export async function getRole(userId: string): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role ?? null;
}

/** Read routes: any signed-in user with a role (admin, seller or viewer).
 * Catalog, stock and sales data are internal to the shop, never public. */
export async function requireUser(
  request?: Request,
): Promise<(User & { role: string }) | null> {
  const user = await getRequestUser(request);
  if (!user) return null;
  const role = await getRole(user.id);
  if (!role) return null;
  return { ...user, role };
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
