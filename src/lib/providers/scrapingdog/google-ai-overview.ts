import { logProviderRun } from "@/lib/providers/dataforseo";

function getApiKey(): string | null {
  return process.env.SCRAPINGDOG_API_KEY?.trim() ?? process.env.SCRAPING_DOG_API_KEY?.trim() ?? null;
}

export function isScrapingDogGoogleAiConfigured(): boolean {
  return Boolean(getApiKey());
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function flattenTextBlocks(textBlocks: unknown): string {
  if (!Array.isArray(textBlocks)) return "";
  const parts: string[] = [];
  for (const b of textBlocks) {
    if (!isRecord(b)) continue;
    if (typeof b.snippet === "string" && b.snippet.trim()) parts.push(b.snippet.trim());
    const list = b.list;
    if (Array.isArray(list)) {
      for (const row of list) {
        if (isRecord(row) && typeof row.snippet === "string" && row.snippet.trim()) {
          parts.push(row.snippet.trim());
        }
      }
    }
  }
  return parts.join("\n\n").slice(0, 12_000);
}

function referencesFromList(refs: unknown): Array<{ url?: string; label?: string }> {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((r, i) => {
      if (!isRecord(r)) return null;
      const url = typeof r.link === "string" ? r.link : typeof r.url === "string" ? r.url : undefined;
      const label =
        typeof r.title === "string"
          ? r.title
          : typeof r.source === "string"
            ? r.source
            : undefined;
      if (!url) return null;
      return { url, label, position: i + 1 };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function buildOverviewPayload(inner: Record<string, unknown>): {
  text: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
} {
  const blocks = inner.text_blocks ?? inner.textBlocks;
  const markdown =
    typeof inner.markdown === "string" && inner.markdown.trim()
      ? inner.markdown.trim()
      : flattenTextBlocks(blocks);
  const sources = referencesFromList(inner.references ?? inner.References);
  return { text: markdown, sources };
}

function extractInlineAiOverview(raw: Record<string, unknown>): Record<string, unknown> | null {
  const aio = raw.ai_overview ?? raw.aiOverview;
  if (!isRecord(aio)) return null;
  if (Array.isArray(aio.text_blocks) || Array.isArray(aio.textBlocks) || Array.isArray(aio.references)) {
    return aio;
  }
  return null;
}

function findAiOverviewFetchUrl(raw: unknown, depth = 0): string | null {
  if (depth > 14 || raw == null) return null;
  if (typeof raw === "string") {
    if (!raw.startsWith("http")) return null;
    if (/vertexaisearch|\/async=_rpc|ai_overview/i.test(raw) && raw.length < 4000) return raw;
    return null;
  }
  if (Array.isArray(raw)) {
    for (const el of raw) {
      const f = findAiOverviewFetchUrl(el, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (!isRecord(raw)) return null;
  const preferKeys = ["ai_overview_link", "ai_overview_url", "aiOverviewLink", "ai_overview_page_url"];
  for (const k of preferKeys) {
    const v = raw[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.startsWith("http") && /overview|vertexai|ai_overview/i.test(k)) return v;
    const nested = findAiOverviewFetchUrl(v, depth + 1);
    if (nested) return nested;
  }
  return null;
}

async function fetchGoogleSerp(query: string, organizationId?: string): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("SCRAPINGDOG_API_KEY is not configured");

  const url = new URL("https://api.scrapingdog.com/google");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query.slice(0, 400));
  url.searchParams.set("country", "us");
  url.searchParams.set("language", "en");

  const start = Date.now();
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: "google",
    request: { query },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    throw new Error(String(data.message ?? data.error ?? `ScrapingDog google ${res.status}`));
  }
  return data;
}

async function fetchAiOverviewByUrl(fetchUrl: string, organizationId?: string): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("SCRAPINGDOG_API_KEY is not configured");

  const url = new URL("https://api.scrapingdog.com/google/ai_overview");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("url", fetchUrl);

  const start = Date.now();
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: "google/ai_overview",
    request: { url: fetchUrl },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    throw new Error(String(data.message ?? data.error ?? `ScrapingDog ai_overview ${res.status}`));
  }
  return data;
}

export type GoogleAiOverviewResult = {
  text: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
  fanouts: string[];
  hasAiOverview: boolean;
};

export async function fetchGoogleAiOverview(params: {
  query: string;
  organizationId?: string;
}): Promise<GoogleAiOverviewResult | null> {
  if (!isScrapingDogGoogleAiConfigured()) return null;

  const q = params.query.trim().slice(0, 400);
  if (!q) return null;

  try {
    const serpRaw = await fetchGoogleSerp(q, params.organizationId);
    const inline = extractInlineAiOverview(serpRaw);
    if (inline) {
      const parsed = buildOverviewPayload(inline);
      if (parsed.text || parsed.sources.length) {
        return { ...parsed, fanouts: [], hasAiOverview: true };
      }
    }

    const fetchUrl = findAiOverviewFetchUrl(serpRaw);
    if (!fetchUrl) {
      return { text: "", sources: [], fanouts: [], hasAiOverview: false };
    }

    const detail = await fetchAiOverviewByUrl(fetchUrl, params.organizationId);
    const inner = (detail.ai_overview as Record<string, unknown>) ?? detail;
    const parsed = buildOverviewPayload(inner);
    const hasAiOverview = Boolean(parsed.text || parsed.sources.length);
    return { ...parsed, fanouts: [], hasAiOverview };
  } catch {
    return null;
  }
}
