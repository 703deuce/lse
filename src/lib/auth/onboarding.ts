import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 0;
  while (true) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

export async function ensureUserOrganization(user: User): Promise<string> {
  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    await upsertProfile(user);
    return membership.organization_id;
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "My Workspace";

  const slug = await uniqueSlug(slugify(displayName));

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: displayName,
      slug,
      plan: "starter",
      created_by: user.id,
      status: "active",
      billing_status: "manual",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to create organization: ${orgError?.message}`);
  }

  await supabaseAdmin.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  await upsertProfile(user);
  return org.id;
}

async function upsertProfile(user: User): Promise<void> {
  await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export async function getOrganizationIdForUser(userId: string): Promise<string | null> {
  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}
