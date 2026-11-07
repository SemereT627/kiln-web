import { createServiceClient } from "@/lib/supabase/server";

/** Email addresses of every admin, for system notifications. */
export async function getAdminEmails(): Promise<string[]> {
  const supabase = await createServiceClient();
  const { data: admins } = await supabase.from("user_profiles").select("id").eq("role", "admin");
  const emails = await Promise.all(
    (admins ?? []).map(async (a) => {
      const { data } = await supabase.auth.admin.getUserById(a.id);
      return data?.user?.email ?? null;
    }),
  );
  return emails.filter((e): e is string => !!e);
}
