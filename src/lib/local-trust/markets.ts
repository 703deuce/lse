import { createServiceClient } from "@/lib/db/client";
import { canonicalizeUrl } from "@/lib/local-trust/canonical-url";

export type LocalTrustMarket = {
  city: string;
  state: string;
  county: string | null;
  latestRunId: string | null;
  latestRunAt: string | null;
  acceptedCount: number;
  rejectedCount: number;
  scanCount: number;
};

export type LocalTrustRunSummary = {
  id: string;
  city: string | null;
  state: string | null;
  county: string | null;
  status: string;
  scan_type: string;
  opportunities_found: number;
  filtered_out_count: number | null;
  created_at: string;
  finished_at: string | null;
  rescan_summary_json: Record<string, unknown> | null;
};

function marketKey(city: string, state: string) {
  return `${city.toLowerCase()}|${state.toLowerCase()}`;
}

export async function listLocalTrustMarkets(businessId: string): Promise<LocalTrustMarket[]> {
  const supabase = createServiceClient();

  const { data: runs } = await supabase
    .from("local_trust_runs")
    .select("id, city, state, county, status, created_at, finished_at, opportunities_found, filtered_out_count, scan_type")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const { data: opps } = await supabase
    .from("local_trust_opportunities")
    .select("market_city, market_state, status, canonical_url, url, run_id")
    .eq("business_id", businessId);

  const runsById = new Map((runs ?? []).map((r) => [r.id as string, r]));
  const latestRunByMarket = new Map<string, string>();
  for (const run of runs ?? []) {
    const city = (run.city as string) ?? "";
    const state = (run.state as string) ?? "";
    if (!city || !state || run.status !== "complete") continue;
    const key = marketKey(city, state);
    if (!latestRunByMarket.has(key)) latestRunByMarket.set(key, run.id as string);
  }

  const acceptedByMarket = new Map<string, Set<string>>();
  for (const row of opps ?? []) {
    if (row.status !== "open") continue;
    let city = (row.market_city as string) ?? "";
    let state = (row.market_state as string) ?? "";
    const run = runsById.get(row.run_id as string);
    if (!city || !state) {
      city = (run?.city as string) ?? "";
      state = (run?.state as string) ?? "";
    }
    if (!city || !state) continue;
    const key = marketKey(city, state);
    const latestRunId = latestRunByMarket.get(key);
    if (latestRunId && row.run_id !== latestRunId) continue;
    if (!acceptedByMarket.has(key)) acceptedByMarket.set(key, new Set());
    const canon = (row.canonical_url as string) || canonicalizeUrl(row.url as string);
    acceptedByMarket.get(key)!.add(canon);
  }

  const markets = new Map<string, LocalTrustMarket>();

  for (const run of runs ?? []) {
    const city = (run.city as string) ?? "";
    const state = (run.state as string) ?? "";
    if (!city || !state) continue;
    const key = marketKey(city, state);
    const existing = markets.get(key);
    const rejected = (run.filtered_out_count as number) ?? 0;

    if (!existing) {
      const deduped = acceptedByMarket.get(key)?.size ?? 0;
      const latestFound =
        run.status === "complete" ? Number(run.opportunities_found ?? 0) : 0;
      markets.set(key, {
        city,
        state,
        county: (run.county as string) ?? null,
        latestRunId: run.status === "complete" ? (run.id as string) : null,
        latestRunAt: run.finished_at ?? run.created_at,
        acceptedCount: deduped > 0 ? deduped : latestFound,
        rejectedCount: run.status === "complete" ? rejected : 0,
        scanCount: 1,
      });
    } else {
      existing.scanCount += 1;
      if (run.status === "complete" && (!existing.latestRunAt || run.created_at > existing.latestRunAt)) {
        existing.latestRunId = run.id as string;
        existing.latestRunAt = (run.finished_at ?? run.created_at) as string;
        existing.rejectedCount = rejected;
      }
      existing.acceptedCount = acceptedByMarket.get(key)?.size ?? existing.acceptedCount;
    }
  }

  return [...markets.values()].sort((a, b) => {
    const ta = a.latestRunAt ? new Date(a.latestRunAt).getTime() : 0;
    const tb = b.latestRunAt ? new Date(b.latestRunAt).getTime() : 0;
    return tb - ta;
  });
}

export async function listLocalTrustRuns(businessId: string): Promise<LocalTrustRunSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("local_trust_runs")
    .select(
      "id, city, state, county, status, scan_type, opportunities_found, filtered_out_count, created_at, finished_at, rescan_summary_json"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LocalTrustRunSummary[];
}

export async function countMarketAcceptedOpportunities(
  businessId: string,
  marketCity: string,
  marketState: string
): Promise<number> {
  const supabase = createServiceClient();
  const { data: latestRun } = await supabase
    .from("local_trust_runs")
    .select("id, opportunities_found")
    .eq("business_id", businessId)
    .eq("city", marketCity)
    .eq("state", marketState)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun?.id) return 0;

  const { data } = await supabase
    .from("local_trust_opportunities")
    .select("canonical_url, url, status")
    .eq("business_id", businessId)
    .eq("run_id", latestRun.id)
    .eq("status", "open");

  const seen = new Set<string>();
  for (const row of data ?? []) {
    const canon = (row.canonical_url as string) || canonicalizeUrl(row.url as string);
    seen.add(canon);
  }
  return seen.size > 0 ? seen.size : Number(latestRun.opportunities_found ?? 0);
}

export async function suggestNearbyMarkets(businessId: string, excludeCity: string, excludeState: string) {
  const supabase = createServiceClient();
  const scanned = new Set([marketKey(excludeCity, excludeState)]);

  const { data: existingRuns } = await supabase
    .from("local_trust_runs")
    .select("city, state")
    .eq("business_id", businessId)
    .eq("status", "complete");
  for (const r of existingRuns ?? []) {
    if (r.city && r.state) scanned.add(marketKey(r.city as string, r.state as string));
  }

  const suggestions: Array<{ city: string; state: string }> = [];
  const seen = new Set<string>();

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("city, state")
    .eq("business_id", businessId);
  for (const k of keywords ?? []) {
    if (!k.city || !k.state) continue;
    const key = marketKey(k.city as string, k.state as string);
    if (scanned.has(key) || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ city: k.city as string, state: k.state as string });
  }

  const { data: locations } = await supabase
    .from("rank_locations")
    .select("label, city, state")
    .eq("business_id", businessId);
  for (const loc of locations ?? []) {
    const city = (loc.city as string) || (loc.label as string)?.split(",")[0]?.trim();
    const state = loc.state as string;
    if (!city || !state) continue;
    const key = marketKey(city, state);
    if (scanned.has(key) || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ city, state });
  }

  return suggestions.slice(0, 8);
}
