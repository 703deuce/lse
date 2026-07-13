import { createServiceClient } from "@/lib/db/client";
import { DashboardHeader } from "@/components/overview/dashboard-header";
import { DashboardQuickActions } from "@/components/overview/dashboard-quick-actions";
import { DashboardRecentScans } from "@/components/overview/dashboard-recent-scans";
import { DashboardFeaturedReports } from "@/components/overview/dashboard-featured-reports";
import { DashboardToolsRow } from "@/components/overview/dashboard-tools-row";
import { ModulePage } from "@/components/ui/design-system";
import { loadDashboardFeatured } from "@/lib/overview/load-dashboard-featured";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";

async function resolvePreviewBusiness(): Promise<{
  id: string;
  name: string;
  businesses: Array<{ id: string; name: string }>;
} | null> {
  const supabase = createServiceClient();
  const envId = process.env.DEV_BUSINESS_ID?.trim();
  const useEnvId = envId && envId !== "preview" && envId.length >= 8;

  const { data: allBusinesses } = await supabase
    .from("businesses")
    .select("id, name")
    .order("name");

  const businesses = (allBusinesses ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
  }));

  if (!businesses.length) return null;

  const selected =
    (useEnvId ? businesses.find((b) => b.id === envId) : null) ?? businesses[0];

  return { id: selected.id, name: selected.name, businesses };
}

export default async function OverviewPreviewPage() {
  const resolved = await resolvePreviewBusiness();

  if (!resolved) {
    return (
      <ModulePage wide className="!space-y-4 px-5 py-6 lg:px-8">
        <p className="text-sm text-zinc-600">
          No businesses found. Set <code className="text-xs">DEV_BUSINESS_ID</code> to a real
          business UUID to preview the dashboard with live data.
        </p>
      </ModulePage>
    );
  }

  const { id: businessId, name: businessName, businesses } = resolved;

  const [recentScans, featured] = await Promise.all([
    loadDashboardRecentScans(businessId, { preview: 3 }),
    loadDashboardFeatured(businessId),
  ]);

  return (
    <ModulePage wide className="!space-y-4 px-5 py-6 lg:px-8">
      <DashboardHeader
        userName="Anthony"
        businessId={businessId}
        businessName={businessName}
        businesses={businesses}
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
