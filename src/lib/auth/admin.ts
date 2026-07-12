import { createServiceClient } from "@/lib/db/client";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(email: string | null | undefined): Promise<void> {
  if (!isAdminEmail(email)) {
    throw new Error("Admin access required");
  }
}

export async function listOrganizationsForAdmin() {
  const supabase = createServiceClient();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, plan, status, billing_status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const results = [];
  for (const org of orgs ?? []) {
    const { data: ownerMember } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    let ownerEmail: string | null = null;
    if (ownerMember?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", ownerMember.user_id)
        .maybeSingle();
      ownerEmail = profile?.email ?? null;
    }

    results.push({ ...org, ownerEmail });
  }

  return results;
}
