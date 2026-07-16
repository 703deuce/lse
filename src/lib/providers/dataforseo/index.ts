import { createServiceClient } from "@/lib/db/client";
import { hashRequest } from "@/lib/utils";
import { buildMapsLiveRequest, mapsLiveRequestBody } from "@/lib/providers/dataforseo/build-maps-request";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import {
  LOCAL_FALCON_PARITY,
  SEARCH_THIS_AREA_FALLBACK,
  isNoSearchResultsError,
} from "@/lib/maps/local-falcon-parity";
import {
  estimateProviderCost,
  fetchWithTimeout,
  providerTimeoutMs,
} from "@/lib/providers/fetch-with-timeout";

export function mapsDepthDefault(): number {
  const env = Number(process.env.DATAFORSEO_MAPS_DEPTH ?? LOCAL_FALCON_PARITY.gridDepth);
  return Number.isFinite(env) && env > 0 ? Math.min(env, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
export type { TargetMatchResult, TargetMatchInput } from "@/lib/providers/dataforseo/match-target";

export interface ProviderRunLog {
  organizationId?: string;
  provider: string;
  endpoint: string;
  request: unknown;
  response: unknown;
  statusCode: number;
  latencyMs: number;
  costEstimate?: number;
  externalTaskId?: string;
}

export async function logProviderRun(log: ProviderRunLog): Promise<void> {
  let requestHash = "";
  try {
    const supabase = createServiceClient();
    requestHash = await hashRequest(log.request);
    await supabase.from("provider_runs").insert({
      organization_id: log.organizationId ?? null,
      provider: log.provider,
      endpoint: log.endpoint,
      request_hash: requestHash,
      external_task_id: log.externalTaskId ?? null,
      status_code: log.statusCode,
      latency_ms: log.latencyMs,
      cost_estimate: log.costEstimate ?? null,
      raw_request_json: log.request as Record<string, unknown>,
      raw_response_json: log.response as Record<string, unknown>,
    });
  } catch {
    // Non-blocking audit log
  }

  // Ledger successful paid provider calls when org is known (idempotent via request hash).
  if (
    log.organizationId &&
    log.statusCode >= 200 &&
    log.statusCode < 300 &&
    !["nominatim", "twilio", "brevo"].includes(log.provider)
  ) {
    try {
      const { trackProviderUsage } = await import("@/lib/providers/gateway");
      const cost =
        log.costEstimate ??
        (await import("@/lib/providers/fetch-with-timeout")).estimateProviderCost(log.provider);
      await trackProviderUsage(log.provider, {
        organizationId: log.organizationId,
        feature: `${log.provider}:${log.endpoint}`,
        unitType: "request",
        estimatedCostUsd: cost,
        actualCostUsd: cost,
        actualUnits: 1,
        idempotencyKey: `${log.provider}:${log.endpoint}:${log.organizationId}:${requestHash || log.latencyMs}`,
      });
    } catch {
      // Non-blocking ledger
    }
  }
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) {
    throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  }
  return { username, password };
}

function authHeader(): string {
  const { username, password } = getCredentials();
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

function summarizeDataForSeoResponse(endpoint: string, httpStatus: number, data: unknown, latencyMs: number) {
  const payload = data as {
    tasks?: Array<{
      id?: string;
      status_code?: number;
      status_message?: string;
      result?: Array<{ items?: unknown[]; keyword?: string }>;
    }>;
  };
  const task = payload.tasks?.[0];
  const firstResult = task?.result?.[0];
  return {
    endpoint,
    httpStatus,
    latencyMs,
    taskId: task?.id ?? null,
    taskStatus: task?.status_code ?? null,
    taskMessage: task?.status_message ?? null,
    resultCount: task?.result?.length ?? 0,
    itemCount: firstResult?.items?.length ?? 0,
    keyword: firstResult?.keyword ?? null,
  };
}

const DATAFORSEO_QUEUE_STATUSES = new Set([40601, 40602]);

function isDataForSeoQueueStatus(status: number | null | undefined): boolean {
  return status != null && DATAFORSEO_QUEUE_STATUSES.has(status);
}

function logDataForSeoResponse(
  endpoint: string,
  httpStatus: number,
  data: unknown,
  latencyMs: number,
  options?: { quietQueue?: boolean }
): void {
  const summary = summarizeDataForSeoResponse(endpoint, httpStatus, data, latencyMs);
  const isQueue = isDataForSeoQueueStatus(summary.taskStatus);
  const isTaskError =
    summary.taskStatus != null &&
    summary.taskStatus >= 40000 &&
    !isQueue;
  const isHttpError = httpStatus >= 400;
  const isEmptyMaps =
    endpoint.includes("maps") && summary.taskStatus === 20000 && summary.itemCount === 0;

  if (isQueue) {
    if (!options?.quietQueue) {
      console.log("[DataForSEO] Task queued:", summary);
    }
    return;
  }

  if (isHttpError || isTaskError) {
    console.error("[DataForSEO] Request failed:", summary);
    console.error("[DataForSEO] Full response:", JSON.stringify(data, null, 2));
    return;
  }

  if (isEmptyMaps) {
    console.warn("[DataForSEO] Request OK but returned 0 map items:", summary);
    console.warn("[DataForSEO] Full response:", JSON.stringify(data, null, 2));
    return;
  }

  console.log("[DataForSEO] Request OK:", summary);
}

async function dataForSeoRequest<T>(
  endpoint: string,
  body: unknown,
  organizationId?: string
): Promise<T> {
  const start = Date.now();
  const url = `https://api.dataforseo.com/v3/${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Array.isArray(body) ? body : [body]),
    },
    {
      provider: "dataforseo",
      timeoutMs: providerTimeoutMs("dataforseo", 90_000),
      label: endpoint,
    }
  );
  const latencyMs = Date.now() - start;
  const data = await res.json();
  logDataForSeoResponse(endpoint, res.status, data, latencyMs);
  await logProviderRun({
    organizationId,
    provider: "dataforseo",
    endpoint,
    request: body,
    response: data,
    statusCode: res.status,
    latencyMs,
    costEstimate: estimateProviderCost("dataforseo"),
  });
  if (!res.ok) {
    const msg = `DataForSEO HTTP ${res.status}: ${JSON.stringify(data)}`;
    console.error("[DataForSEO] Throwing:", msg);
    throw new Error(msg);
  }

  const task = (data as { tasks?: Array<{ status_code?: number; status_message?: string }> })?.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000 && !isDataForSeoQueueStatus(task.status_code)) {
    const msg = task.status_message ?? `DataForSEO task error ${task.status_code}`;
    console.error(`[DataForSEO] Throwing task error ${task.status_code}:`, msg);
    throw new Error(msg);
  }

  return data as T;
}

export interface MapsLiveResult {
  rank_group?: number;
  rank_absolute?: number;
  title?: string;
  place_id?: string;
  cid?: string;
  rating?: { value?: number; votes_count?: number };
  category?: string;
  additional_categories?: string[];
  address?: string;
  phone?: string;
  url?: string;
  domain?: string;
  work_hours?: unknown;
  is_claimed?: boolean;
  local_justifications?: unknown[];
  latitude?: number;
  longitude?: number;
}

export interface MapsLiveResponse {
  tasks?: Array<{
    id?: string;
    status_code?: number;
    result?: Array<{
      keyword?: string;
      check_url?: string;
      datetime?: string;
      items?: MapsLiveResult[];
    }>;
  }>;
}

export async function mapsLiveAdvanced(params: {
  keyword: string;
  lat: number;
  lng: number;
  languageCode?: string;
  device?: string;
  os?: string;
  browser?: string;
  depth?: number;
  searchThisArea?: boolean;
  searchPlaces?: boolean;
  seDomain?: string;
  zoom?: number;
  usedSearchThisAreaFallback?: boolean;
  organizationId?: string;
}): Promise<{
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: ReturnType<typeof buildMapsLiveRequest>;
}> {
  const profile = {
    device: (params.device === "mobile" ? "mobile" : "desktop") as "mobile" | "desktop",
    os: (params.os ?? DEFAULT_SCAN_PROFILE.os) as "android" | "ios" | "windows" | "macos",
    browser: (params.browser === "firefox" ? "firefox" : "chrome") as "chrome" | "firefox",
  };
  const request = buildMapsLiveRequest({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    profile,
    depth: params.depth,
    languageCode: params.languageCode,
    zoom: params.zoom,
    searchThisArea: params.searchThisArea,
    searchPlaces: params.searchPlaces,
    seDomain: params.seDomain,
    usedSearchThisAreaFallback: params.usedSearchThisAreaFallback,
  });

  const data = await dataForSeoRequest<MapsLiveResponse>(
    request._meta.endpoint,
    mapsLiveRequestBody(request),
    params.organizationId
  );

  const task = data.tasks?.[0];
  const result = task?.result?.[0];
  return {
    items: result?.items ?? [],
    checkUrl: result?.check_url,
    timestamp: result?.datetime,
    request,
  };
}

/**
 * Grid cell fetch — Local Falcon parity first (search_this_area=true),
 * then fallback to broader Maps results on edge-pin 40102 errors.
 */
export async function mapsLiveGridCell(
  params: Parameters<typeof mapsLiveAdvanced>[0]
): Promise<ReturnType<typeof mapsLiveAdvanced>> {
  let lastError: Error | null = null;

  for (const searchThisArea of [LOCAL_FALCON_PARITY.searchThisArea, SEARCH_THIS_AREA_FALLBACK]) {
    const usedFallback = searchThisArea === SEARCH_THIS_AREA_FALLBACK;
    try {
      const live = await mapsLiveAdvanced({
        ...params,
        searchThisArea,
        usedSearchThisAreaFallback: usedFallback,
      });
      if (live.items.length > 0) return live;
      if (!usedFallback) continue;
      throw new Error("DataForSEO returned no map results for this cell");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!usedFallback && isNoSearchResultsError(lastError)) continue;
      if (!usedFallback && lastError.message.includes("no map results")) continue;
      if (usedFallback) throw lastError;
    }
  }

  throw lastError ?? new Error("No Search Results.");
}

export interface BusinessInfoItem {
  title?: string;
  place_id?: string;
  cid?: string;
  category?: string;
  additional_categories?: string[];
  address?: string;
  phone?: string;
  url?: string;
  rating?: { value?: number; votes_count?: number };
  latitude?: number;
  longitude?: number;
  description?: string;
  attributes?: unknown;
  place_topics?: unknown;
  work_time?: unknown;
  is_claimed?: boolean;
}

export async function myBusinessInfo(params: {
  keyword: string;
  locationName?: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeId?: string | null;
  cid?: string | null;
  organizationId?: string;
}): Promise<BusinessInfoItem[]> {
  let keyword = params.keyword.trim();
  if (params.cid) {
    keyword = params.cid.startsWith("cid:") ? params.cid : `cid:${params.cid}`;
  } else if (params.placeId) {
    keyword = params.placeId;
  }

  const payload: Record<string, string> = {
    keyword,
    language_code: "en",
  };

  const usesDirectId = Boolean(params.cid || params.placeId);

  if (params.lat != null && params.lng != null) {
    payload.location_coordinate = `${params.lat},${params.lng},5000`;
  } else if (!usesDirectId) {
    const city = params.city ?? params.locationName;
    const state = params.state;
    const country = params.country ?? "United States";
    if (city && state) {
      payload.location_name = `${city},${state},${country}`;
    } else if (city?.includes(",")) {
      payload.location_name = city;
    } else if (state) {
      payload.location_name = `${city ?? state},${state},${country}`;
    } else {
      payload.location_name = country;
    }
  }

  const data = await dataForSeoRequest<{
    tasks?: Array<{ result?: Array<{ items?: BusinessInfoItem[] }> }>;
  }>("business_data/google/my_business_info/live", payload, params.organizationId);
  return data.tasks?.[0]?.result?.[0]?.items ?? [];
}

export async function taskPostMaps(params: {
  tasks: Array<{
    keyword: string;
    lat: number;
    lng: number;
    postbackUrl?: string;
    tag?: string;
  }>;
  organizationId?: string;
}): Promise<string[]> {
  const payload = params.tasks.map((t) => {
    const task: Record<string, unknown> = {
      keyword: t.keyword,
      location_coordinate: `${t.lat},${t.lng},14`,
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 100,
      tag: t.tag,
    };
    if (t.postbackUrl) task.postback_url = t.postbackUrl;
    return task;
  });

  const data = await dataForSeoRequest<{
    tasks?: Array<{ id?: string }>;
  }>("serp/google/maps/task_post", payload, params.organizationId);

  return (data.tasks ?? []).map((t) => t.id ?? "").filter(Boolean);
}

export async function googleReviews(params: {
  placeId: string;
  depth?: number;
  organizationId?: string;
}): Promise<unknown[]> {
  const depth = Math.min(params.depth ?? 10, 30);
  const data = await dataForSeoRequest<{
    tasks?: Array<{ result?: Array<{ items?: unknown[] }> }>;
  }>(
    "business_data/google/reviews/task_post",
    {
      place_id: params.placeId,
      depth,
      language_code: "en",
    },
    params.organizationId
  );
  return data.tasks?.[0]?.result?.[0]?.items ?? [];
}

export interface GoogleReviewsLiveResult {
  items: unknown[];
  timedOut: boolean;
  lastStatus?: number;
  attempts: number;
}

export async function googleReviewsLive(params: {
  placeId?: string | null;
  cid?: string | null;
  keyword?: string;
  locationCoordinate?: string;
  depth?: number;
  organizationId?: string;
}): Promise<GoogleReviewsLiveResult> {
  const payload: Record<string, unknown> = {
    depth: Math.min(params.depth ?? 50, 100),
    language_code: "en",
    sort_by: "newest",
  };

  if (params.placeId) payload.place_id = params.placeId;
  else if (params.cid) {
    const c = params.cid.replace(/^cid:/, "");
    if (/^\d+$/.test(c)) payload.cid = c;
    else payload.keyword = c.includes(":") ? `cid:${c}` : c;
  } else if (params.keyword) {
    payload.keyword = params.keyword;
  }

  if (params.locationCoordinate) payload.location_coordinate = params.locationCoordinate;
  else payload.location_name = "United States";

  const post = await dataForSeoRequest<{ tasks?: Array<{ id?: string }> }>(
    "business_data/google/reviews/task_post",
    payload,
    params.organizationId
  );
  const taskId = post.tasks?.[0]?.id;
  if (!taskId) return { items: [], timedOut: false, attempts: 0 };

  const maxAttempts = 45;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));

    const result = await dataForSeoGet<{
      tasks?: Array<{
        status_code?: number;
        result?: Array<{ items?: unknown[] }>;
      }>;
    }>(`business_data/google/reviews/task_get/${taskId}`, params.organizationId, { quietQueue: true });

    const task = result.tasks?.[0];
    const items = task?.result?.[0]?.items;
    if (items?.length) {
      return { items, timedOut: false, lastStatus: task?.status_code, attempts: attempt + 1 };
    }

    lastStatus = task?.status_code;
    if (lastStatus != null && lastStatus >= 40000 && !isDataForSeoQueueStatus(lastStatus)) {
      console.error("[DataForSEO] Reviews task failed:", { taskId, status: lastStatus, attempt: attempt + 1 });
      break;
    }
  }

  console.error("[DataForSEO] Reviews task timed out:", { taskId, lastStatus, maxAttempts });
  return { items: [], timedOut: true, lastStatus, attempts: maxAttempts };
}

async function dataForSeoGet<T>(
  endpoint: string,
  organizationId?: string,
  options?: { quietQueue?: boolean }
): Promise<T> {
  const start = Date.now();
  const url = `https://api.dataforseo.com/v3/${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { Authorization: authHeader() },
    },
    {
      provider: "dataforseo",
      timeoutMs: providerTimeoutMs("dataforseo", 90_000),
      label: endpoint,
    }
  );
  const latencyMs = Date.now() - start;
  const data = await res.json();
  logDataForSeoResponse(endpoint, res.status, data, latencyMs, options);
  await logProviderRun({
    organizationId,
    provider: "dataforseo",
    endpoint,
    request: {},
    response: data,
    statusCode: res.status,
    latencyMs,
    costEstimate: estimateProviderCost("dataforseo"),
  });
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  return data as T;
}

export async function getMapsTaskResult(taskId: string, organizationId?: string) {
  return dataForSeoRequest<MapsLiveResponse>(
    `serp/google/maps/task_get/advanced/${taskId}`,
    {},
    organizationId
  );
}

export function extractTopCompetitors(items: MapsLiveResult[], limit = 100) {
  return items.slice(0, limit).map((item, idx) => ({
    rank: item.rank_group ?? idx + 1,
    name: item.title,
    cid: item.cid,
    place_id: item.place_id,
    rating: item.rating?.value,
    review_count: item.rating?.votes_count,
    category: item.category,
    address: item.address,
    phone: item.phone,
    url: item.url,
    local_justifications: item.local_justifications,
  }));
}
