import { createServiceClient } from "@/lib/db/client";
import { hashRequest } from "@/lib/utils";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { buildBrightDataMapsUrl } from "@/lib/providers/brightdata/url";

function getApiKey(): string {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("BRIGHTDATA_API_KEY is required");
  return key;
}

async function resolveBrightDataZone(): Promise<string> {
  const fromEnv = process.env.BRIGHTDATA_ZONE ?? process.env.BRIGHTDATA_SERP_ZONE;
  if (fromEnv?.trim()) return fromEnv.trim();

  const res = await fetch("https://api.brightdata.com/zone/get_active_zones", {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (res.ok) {
    const zones = (await res.json()) as Array<{ name?: string; type?: string }>;
    const serp = zones.find((z) => /serp|unlocker/i.test(z.type ?? "") || /serp/i.test(z.name ?? ""));
    if (serp?.name) return serp.name;
    if (zones[0]?.name) return zones[0].name;
  }

  throw new Error(
    "BRIGHTDATA_ZONE is required — create a SERP API zone at https://brightdata.com/cp/zones (residential proxy returns HTML, not ranked Maps JSON)"
  );
}

function getZone(): string {
  const zone = process.env.BRIGHTDATA_ZONE ?? process.env.BRIGHTDATA_SERP_ZONE;
  if (!zone?.trim()) {
    throw new Error(
      "BRIGHTDATA_ZONE is required — set in .env.local or create a SERP API zone at https://brightdata.com/cp/zones"
    );
  }
  return zone.trim();
}

export type BrightDataOrganicItem = {
  global_rank?: number;
  rank?: number;
  title?: string;
  address?: string;
  phone?: string;
  link?: string;
  map_link?: string;
  map_id?: string;
  map_id_encoded?: string;
  fid?: string;
  rating?: number;
  reviews_cnt?: number;
  latitude?: number;
  longitude?: number;
  category?: Array<{ id?: string; title?: string; title_short?: string }>;
};

type BrightDataMapsResponse = {
  organic?: BrightDataOrganicItem[];
  place?: BrightDataOrganicItem;
  body?: string | BrightDataMapsResponse;
};

async function logBrightDataRun(params: {
  organizationId?: string;
  endpoint: string;
  request: Record<string, unknown>;
  response: unknown;
  statusCode: number;
  latencyMs: number;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const requestHash = await hashRequest(params.request);
    await supabase.from("provider_runs").insert({
      organization_id: params.organizationId ?? null,
      provider: "brightdata",
      endpoint: params.endpoint,
      request_hash: requestHash,
      status_code: params.statusCode,
      latency_ms: params.latencyMs,
      raw_request_json: params.request,
      raw_response_json: params.response as Record<string, unknown>,
    });
  } catch {
    /* non-blocking */
  }
}


function parseBrightDataBody(text: string): BrightDataOrganicItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const unwrap = (payload: unknown): BrightDataOrganicItem[] => {
    if (!payload || typeof payload !== "object") return [];
    const o = payload as BrightDataMapsResponse;
    if (Array.isArray(o.organic) && o.organic.length) return o.organic;
    if (o.place) return [o.place];
    if (typeof o.body === "string") {
      try {
        return unwrap(JSON.parse(o.body));
      } catch {
        return [];
      }
    }
    if (o.body && typeof o.body === "object") return unwrap(o.body);
    return [];
  };

  if (Array.isArray(data)) return data as BrightDataOrganicItem[];
  return unwrap(data);
}

/** Bright Data SERP API — Google Maps search at lat/lng (Local Falcon parity) */
export async function mapsSearchAtCoordinate(params: {
  keyword: string;
  lat: number;
  lng: number;
  zoom?: number;
  device?: ScanDeviceProfile["device"];
  os?: ScanDeviceProfile["os"];
  browser?: ScanDeviceProfile["browser"];
  organizationId?: string;
}): Promise<BrightDataOrganicItem[]> {
  const start = Date.now();
  const zone = process.env.BRIGHTDATA_ZONE?.trim() || (await resolveBrightDataZone());
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const url = buildBrightDataMapsUrl({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    zoom,
    device: params.device,
    os: params.os,
    browser: params.browser,
  });
  const requestBody = {
    zone,
    url,
    format: "raw" as const,
    data_format: "parsed_light" as const,
  };

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const text = await res.text();
  const latencyMs = Date.now() - start;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 2000) };
  }

  await logBrightDataRun({
    organizationId: params.organizationId,
    endpoint: "request",
    request: { ...requestBody, keyword: params.keyword, lat: params.lat, lng: params.lng, zoom },
    response: parsed,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    const detail = typeof parsed === "object" && parsed && "error" in parsed
      ? String((parsed as { error?: string }).error)
      : text.slice(0, 300);
    throw new Error(`Bright Data SERP HTTP ${res.status}: ${detail}`);
  }

  const items = parseBrightDataBody(text);
  if (!items.length) {
    const preview = text.slice(0, 200);
    const needsSerp = preview.startsWith("<!") || preview.startsWith("{");
    throw new Error(
      needsSerp
        ? `Bright Data zone "${zone}" returned HTML, not ranked Maps JSON — create a SERP API zone at https://brightdata.com/cp/zones`
        : "Bright Data returned no map results for this cell"
    );
  }
  return items;
}

export {
  buildBrightDataMapsGridRequest,
  mapsGridCell,
  mapsGridDepth,
  normalizeBrightDataResults,
} from "@/lib/providers/brightdata/maps-grid";
export type { BrightDataMapsGridRequest } from "@/lib/providers/brightdata/maps-grid";
