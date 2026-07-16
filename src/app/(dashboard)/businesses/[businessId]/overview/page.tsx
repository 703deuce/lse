import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { DashboardToolsRow } from "@/components/overview/dashboard-tools-row";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { ModulePage } from "@/components/ui/design-system";

export const dynamic = "force-dynamic";

function displayNameFromEmail(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const token = local.split(/[._-]/)[0] ?? local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/** Prefer first name → full name → email local-part (never org slug-looking tokens). */
function greetingNameFromProfile(fullName: string | null | undefined, email: string | null): string {
  const full = String(fullName ?? "").trim();
  if (full) {
    const first = full.split(/\s+/).find(Boolean);
    if (first) return first;
    return full;
  }
  return displayNameFromEmail(email);
}

async function resolveDisplayName(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return greetingNameFromProfile(
    profile?.full_name as string | null | undefined,
    email ?? (profile?.email as string | null) ?? null
  );
}

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const supabase = createServiceClient();
  const [{ data: businesses }, displayName] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name")
      .eq("organization_id", auth.organizationId)
      .order("name"),
    resolveDisplayName(supabase, auth.userId, auth.email),
  ]);

  const [recentScans, featured] = await Promise.all([
    loadDashboardRecentScans(businessId, { preview: 3 }),
    loadDashboardFeatured(businessId),
  ]);

  return (
    <ModulePage wide>
      <DashboardHeader
        userName={displayName}
        businessId={businessId}
        businessName={business.name}
        businesses={(businesses ?? []).map((b) => ({
          id: b.id as string,
          name: b.name as string,
        }))}
      />

      <DashboardQuickActions businessId={businessId} />

      <DashboardRecentScans
        businessId={businessId}
        rows={recentScans.rows}
        total={recentScans.total}
      />

      <DashboardFeaturedReports businessId={businessId} data={featured} />

      <DashboardToolsRow businessId={businessId} />
    </ModulePage>
  );
}
