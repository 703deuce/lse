import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { listClass } from "@/components/ui/design-system";
import {
  isLocationToolSlug,
  LOCATION_TOOL_MODULES,
} from "@/lib/dashboard/tool-modules";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import {
  MapsCampaignsLocationHub,
  type HubLocation,
} from "@/components/campaigns/maps-campaigns-location-hub";
import { getCurrentUsage, getOrganizationPlan } from "@/lib/plans";

type CampaignRow = {
  id: string;
  business_id: string;
  name: string;
  schedule_enabled: boolean | null;
  archived_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type KeywordRow = {
  business_id: string;
  campaign_id: string | null;
  active: boolean | null;
};

function deriveLocationStatus(params: {
  campaigns: CampaignRow[];
  keywordCount: number;
}): HubLocation["status"] {
  const live = params.campaigns.filter((c) => !c.archived_at);
  const archived = params.campaigns.filter((c) => c.archived_at);
  if (!live.length && archived.length) return "archived";
  if (!live.length) return "draft";
  if (live.some((c) => c.schedule_enabled)) return "active";
  if (params.keywordCount === 0) return "draft";
  return "paused";
}

async function loadMapsCampaignsHub(organizationId: string) {
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "id, name, account_type, is_tracked, archived_at, address_text, scan_center_label"
    )
    .eq("organization_id", organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);
  if (!active.length) {
    return { locations: [] as HubLocation[], empty: true as const };
  }

  const businessIds = active.map((b) => b.id);

  const [
    { data: campaigns },
    { data: keywords },
    { count: completedRuns },
    plan,
    usage,
  ] = await Promise.all([
    supabase
      .from("maps_campaigns")
      .select(
        "id, business_id, name, schedule_enabled, archived_at, updated_at, created_at"
      )
      .in("business_id", businessIds)
      .then((res) => {
        if (res.error && /maps_campaigns|does not exist/i.test(res.error.message)) {
          return { data: [] as CampaignRow[], error: null };
        }
        return res;
      }),
    supabase
      .from("business_keywords")
      .select("business_id, campaign_id, active")
      .in("business_id", businessIds)
      .eq("active", true),
    supabase
      .from("scan_batches")
      .select("id", { count: "exact", head: true })
      .in("business_id", businessIds)
      .eq("status", "completed"),
    getOrganizationPlan(organizationId),
    getCurrentUsage(organizationId),
  ]);

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const keywordRows = (keywords ?? []) as KeywordRow[];

  const campaignsByBusiness = new Map<string, CampaignRow[]>();
  for (const c of campaignRows) {
    const list = campaignsByBusiness.get(c.business_id) ?? [];
    list.push(c);
    campaignsByBusiness.set(c.business_id, list);
  }

  const keywordsByBusiness = new Map<string, number>();
  for (const k of keywordRows) {
    keywordsByBusiness.set(
      k.business_id,
      (keywordsByBusiness.get(k.business_id) ?? 0) + 1
    );
  }

  const locations: HubLocation[] = active.map((b) => {
    const bizCampaigns = campaignsByBusiness.get(b.id) ?? [];
    const live = bizCampaigns.filter((c) => !c.archived_at);
    const keywordCount = keywordsByBusiness.get(b.id) ?? 0;
    const latest = [...bizCampaigns].sort((a, b2) => {
      const at = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bt = new Date(b2.updated_at ?? b2.created_at ?? 0).getTime();
      return bt - at;
    })[0];
    const status = deriveLocationStatus({
      campaigns: bizCampaigns,
      keywordCount,
    });

    return {
      id: b.id,
      name: b.name,
      accountType: b.account_type,
      isTracked: b.is_tracked,
      address:
        (b.address_text as string | null)?.trim() ||
        (b.scan_center_label as string | null)?.trim() ||
        null,
      campaignCount: live.length,
      keywordCount,
      activeCampaignCount: live.filter((c) => c.schedule_enabled).length,
      pausedCampaignCount: live.filter((c) => !c.schedule_enabled).length,
      archivedCampaignCount: bizCampaigns.filter((c) => c.archived_at).length,
      latestCampaignName: latest?.name ?? null,
      latestCampaignId: latest?.id ?? null,
      latestUpdatedAt: latest?.updated_at ?? latest?.created_at ?? null,
      status,
    };
  });

  const totalCampaigns = campaignRows.filter((c) => !c.archived_at).length;
  const mapCreditsLimit = plan.limits.map_credits_month;
  const mapCreditsRemaining = Math.max(
    0,
    mapCreditsLimit - (usage.map_credits_used ?? 0)
  );

  return {
    empty: false as const,
    locations,
    totalCampaigns,
    completedRuns: completedRuns ?? 0,
    mapCreditsRemaining,
    mapCreditsLimit,
  };
}

export default async function ToolLocationPickerPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  if (!isLocationToolSlug(slug)) notFound();

  const mod = LOCATION_TOOL_MODULES[slug];
  const auth = await requirePageAuth();

  if (slug === "maps-campaigns") {
    const hub = await loadMapsCampaignsHub(auth.organizationId);
    if (hub.empty) {
      return (
        <ModuleEmptyState
          title="Add a location first"
          description="Choose a prospect or client so Maps Campaigns has a business to work on."
          actionLabel="Add client"
          actionHref="/businesses/new?as=client"
        />
      );
    }
    return (
      <MapsCampaignsLocationHub
        locations={hub.locations}
        totalCampaigns={hub.totalCampaigns}
        completedRuns={hub.completedRuns}
        mapCreditsRemaining={hub.mapCreditsRemaining}
        mapCreditsLimit={hub.mapCreditsLimit}
      />
    );
  }

  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);

  return (
    <>
      <PageHeader title={mod.title} subtitle={mod.description} />
      {!active.length ? (
        <ModuleEmptyState
          title="Add a location first"
          description="Choose a prospect or client so this tool has a business to work on."
          actionLabel="Add client"
          actionHref="/businesses/new?as=client"
        />
      ) : (
        <ul className={listClass}>
          {active.map((b) => {
            const isProspect =
              b.account_type === "prospect" || b.is_tracked === false;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {b.name}
                  </p>
                  <p className="text-xs capitalize text-zinc-500">
                    {isProspect ? "Prospect" : "Client"}
                  </p>
                </div>
                <Link
                  href={`/businesses/${b.id}/${mod.path}`}
                  className="shrink-0 text-xs font-medium text-[#137752] hover:underline"
                >
                  Open {mod.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
