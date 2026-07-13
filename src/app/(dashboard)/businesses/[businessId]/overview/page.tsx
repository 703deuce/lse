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

function displayNameFromEmail(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const token = local.split(/[._-]/)[0] ?? local;
  return token.charAt(0).toUpperCase() + token.slice(1);
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
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const [recentScans, featured] = await Promise.all([
    loadDashboardRecentScans(businessId, { preview: 3 }),
    loadDashboardFeatured(businessId),
  ]);

  return (
    <ModulePage wide className="!space-y-4">
      <DashboardHeader
        userName={displayNameFromEmail(auth.email)}
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
