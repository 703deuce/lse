import type { createServiceClient } from "@/lib/db/client";
import { loadCampaignKeywordMetrics } from "@/lib/campaigns/keyword-metrics";
import { round1 } from "@/lib/reporting/metrics";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type CampaignListRow = {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_enabled: boolean;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  default_grid_size: number;
  default_radius_meters: number;
  keywordCount: number;
  status: "active" | "paused" | "draft";
  avgPosition: number | null;
  avgPositionChange: number | null;
  mapPosition: number | null;
  mapPositionChange: number | null;
  rankingsUp: number;
};

export type CampaignListBusiness = {
  id: string;
  name: string;
  websiteUrl: string | null;
  address: string | null;
  locationLabel: string;
};

export type CampaignListStats = {
  totalKeywords: number;
  activeCampaigns: number;
  rankingsUp: number;
  avgRankPosition: number | null;
};

function locationLabelFromAddress(address: string | null, fallback: string): string {
  if (!address?.trim()) return fallback;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // "13327 Kirkdale Ct, Woodbridge, VA 22193" → Woodbridge
    const city = parts[parts.length - 2]?.replace(/\s+[A-Z]{2}\s+\d+.*/i, "").trim();
    if (city && city.length < 40) return city;
  }
  return parts[0] ?? fallback;
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function loadCampaignListSummaries(
  supabase: ServiceClient,
  businessId: string
): Promise<{
  campaigns: CampaignListRow[];
  business: CampaignListBusiness | null;
  stats: CampaignListStats;
  migrationPending?: boolean;
}> {
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, website_url, address_text, scan_center_label")
    .eq("id", businessId)
    .maybeSingle();

  const { data: campaigns, error } = await supabase
    .from("maps_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    if (/maps_campaigns|does not exist/i.test(error.message)) {
      return {
        campaigns: [],
        business: null,
        stats: {
          totalKeywords: 0,
          activeCampaigns: 0,
          rankingsUp: 0,
          avgRankPosition: null,
        },
        migrationPending: true,
      };
    }
    throw new Error(error.message);
  }

  const locationLabel = locationLabelFromAddress(
    (business?.address_text as string | null) ??
      (business?.scan_center_label as string | null) ??
      null,
    business?.name ? String(business.name) : "—"
  );

  const businessOut: CampaignListBusiness | null = business
    ? {
        id: String(business.id),
        name: String(business.name),
        websiteUrl: (business.website_url as string | null) ?? null,
        address:
          (business.address_text as string | null)?.trim() ||
          (business.scan_center_label as string | null)?.trim() ||
          null,
        locationLabel,
      }
    : null;

  const rows: CampaignListRow[] = [];
  let totalKeywords = 0;
  let rankingsUp = 0;
  const allAvgs: number[] = [];

  for (const raw of campaigns ?? []) {
    const metrics = await loadCampaignKeywordMetrics(supabase, {
      businessId,
      campaignId: String(raw.id),
      gridSize: Number(raw.default_grid_size ?? 7),
      radiusMeters: Number(raw.default_radius_meters ?? 3000),
    });

    const keywordCount = metrics.length;
    totalKeywords += keywordCount;

    const avgs = metrics
      .map((m) => m.latestAverage)
      .filter((n): n is number => n != null && !Number.isNaN(n));
    const changes = metrics
      .map((m) => m.previousChange)
      .filter((n): n is number => n != null && !Number.isNaN(n));
    const campaignRankingsUp = changes.filter((c) => c > 0).length;
    rankingsUp += campaignRankingsUp;
    allAvgs.push(...avgs);

    const avgPosition = mean(avgs);
    const avgPositionChange = mean(changes);
    // Map column: best (lowest) average rank when available, else avg.
    const mapPosition = avgs.length
      ? round1(Math.min(...avgs))
      : null;
    const mapPositionChange =
      changes.length > 0
        ? round1(Math.max(...changes))
        : avgPositionChange;

    let status: CampaignListRow["status"] = "draft";
    if (keywordCount === 0) status = "draft";
    else if (raw.schedule_enabled) status = "active";
    else status = "paused";
    // Manual campaigns with keywords still show Active in the product mockup.
    if (keywordCount > 0 && !raw.schedule_enabled && raw.schedule_type === "manual") {
      status = "active";
    }

    rows.push({
      id: String(raw.id),
      name: String(raw.name),
      description: (raw.description as string | null) ?? null,
      schedule_type: String(raw.schedule_type ?? "manual"),
      schedule_enabled: Boolean(raw.schedule_enabled),
      archived_at: (raw.archived_at as string | null) ?? null,
      created_at: (raw.created_at as string | null) ?? null,
      updated_at: (raw.updated_at as string | null) ?? null,
      default_grid_size: Number(raw.default_grid_size ?? 7),
      default_radius_meters: Number(raw.default_radius_meters ?? 3000),
      keywordCount,
      status,
      avgPosition,
      avgPositionChange,
      mapPosition,
      mapPositionChange,
      rankingsUp: campaignRankingsUp,
    });
  }

  const activeCampaigns = rows.filter((r) => r.status === "active").length;

  return {
    campaigns: rows,
    business: businessOut,
    stats: {
      totalKeywords,
      activeCampaigns,
      rankingsUp,
      avgRankPosition: mean(allAvgs),
    },
  };
}
