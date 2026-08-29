import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().trim().nullable().optional(),
  role: z.enum(["admin", "seller", "viewer"]),
});

const updateRoleSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(["admin", "seller", "viewer"]),
});

const deleteUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceSupabase = await createServiceClient();

  // Fetch all profiles plus email from auth.users via admin API
  const { data: profiles, error: profileError } = await serviceSupabase
    .from("user_profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Get emails via admin listUsers
  const { data: { users }, error: authError } = await serviceSupabase.auth.admin.listUsers();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const emailMap = new Map(users.map((u) => [u.id, u.email]));

  const result = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(request, createUserSchema);
  if ("response" in parsed) return parsed.response;
  const { email, password, fullName, role } = parsed.data;

  const serviceSupabase = await createServiceClient();

  const { data, error } = await serviceSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Failed to create user" },
      { status: 500 },
    );
  }

  if (role !== "viewer") {
    const { error: roleError } = await serviceSupabase
      .from("user_profiles")
      .update({ role })
      .eq("id", data.user.id);

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }
  }

  await logAudit({
    actor: admin,
    action: "user.create",
    targetTable: "user_profiles",
    targetId: data.user.id,
    after: { email, fullName: fullName || null, role },
  });

  return NextResponse.json({ success: true, id: data.user.id });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(request, updateRoleSchema);
  if ("response" in parsed) return parsed.response;
  const { userId, role } = parsed.data;

  const serviceSupabase = await createServiceClient();

  const { data: before } = await serviceSupabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const { error } = await serviceSupabase
    .from("user_profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actor: admin,
    action: "user.role_change",
    targetTable: "user_profiles",
    targetId: userId,
    before: { role: before?.role ?? null },
    after: { role },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(request, deleteUserSchema);
  if ("response" in parsed) return parsed.response;
  const { userId } = parsed.data;

  if (userId === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account" },
      { status: 400 },
    );
  }

  const serviceSupabase = await createServiceClient();

  const { data: profile } = await serviceSupabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();

  const { data: authUser } = await serviceSupabase.auth.admin.getUserById(userId);

  // sales.sold_by has no ON DELETE action — detach this user's past sales
  // records instead of leaving the delete blocked by the FK.
  await serviceSupabase
    .from("sales")
    .update({ sold_by: null })
    .eq("sold_by", userId);

  const { error } = await serviceSupabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actor: admin,
    action: "user.delete",
    targetTable: "user_profiles",
    targetId: userId,
    before: {
      email: authUser?.user?.email ?? null,
      fullName: profile?.full_name ?? null,
      role: profile?.role ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
