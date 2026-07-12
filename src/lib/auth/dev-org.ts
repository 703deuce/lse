import { createServiceClient } from "@/lib/db/client";

export async function ensureDevOrganization(userId: string): Promise<string> {
  const existing = process.env.DEV_ORG_ID;
  if (existing) return existing;

  const supabase = createServiceClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    return membership.organization_id;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: "My Workspace", created_by: userId, plan: "free" })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to create dev organization: ${orgError?.message}`);
  }

  await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  return org.id;
}
