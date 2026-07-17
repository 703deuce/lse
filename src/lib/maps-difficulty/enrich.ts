/**
 * Live enrichment pipeline for Maps Keyword Difficulty.
 *
 * Given a keyword + search point, this:
 *   1. runs a pin-anchored ScrapingDog Maps search and takes the top 3 results
 *   2. enriches each with the exact fields the v6 scorer consumes:
 *      - dated review velocity (30/90/365d, days-since-last) via ScrapingDog
 *      - distance from the search pin (Haversine)
 *      - GMB profile (categories/hours/phone/website) via ScrapingDog place details
 *      - page + root dofollow referring-domain authority via DataForSEO (50/50 combined)
 *      - homepage on-page (title/H1/kw/city) via direct fetch (ScrapingDog fallback)
 *      - dedicated local landing page discovery via DataForSEO site: SERP + OnPage
 *   3. scores the market with scoreMarket()
 *
 * Ported from scripts/review-velocity-*.mjs so the app and the calibration CLI
 * produce identical inputs.
 */

import {
  normalizeBusiness,
  refDomainAuthorityScore,
  scoreMarket,
  type EnrichedBusiness,
  type MarketScore,
} from "@/lib/maps-difficulty/score";
import {
  fetchWithTimeout,
  providerTimeoutMs,
} from "@/lib/providers/fetch-with-timeout";
import {
  buildCompetitorAuthority,
  isSameAuthorityTarget,
  resolvePageTargetUrl,
  type RefDomainsAuthorityData,
} from "@/lib/maps-difficulty/authority";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_ZOOM = 12;
const TOP_N = 3;
const LOOKBACK_DAYS = 365;
const MAX_REVIEW_PAGES = 40;
const REF_DOMAIN_LIMIT = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------
function scrapingDogKey(): string {
  const key = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
  if (!key) throw new Error("Missing SCRAPINGDOG_API_KEY");
  return key;
}
function dfsCreds(): { user: string; pass: string } {
  const user = process.env.DATAFORSEO_USERNAME;
  const pass = process.env.DATAFORSEO_PASSWORD;
  if (!user || !pass) throw new Error("Missing DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD");
  return { user, pass };
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}
function normalizeDomain(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const t = input.trim().toLowerCase();
  if (t.includes("/") || t.startsWith("http")) return domainFromUrl(t);
  return t.replace(/^www\./, "").split("/")[0] || null;
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number | null; lng: number | null }): number | null {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

interface MapsHit {
  title?: string;
  data_id?: string;
  place_id?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  phone?: string;
  address?: string;
  type?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  latitude?: number;
  longitude?: number;
}

function extractCoords(r: MapsHit): { lat: number | null; lng: number | null } {
  const g = r.gps_coordinates ?? {};
  const lat = g.latitude ?? r.latitude;
  const lng = g.longitude ?? r.longitude;
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  const nlat = Number(lat);
  const nlng = Number(lng);
  if (Number.isFinite(nlat) && Number.isFinite(nlng)) return { lat: nlat, lng: nlng };
  return { lat: null, lng: null };
}

// ---------------------------------------------------------------------------
// ScrapingDog
// ---------------------------------------------------------------------------
async function sdGet(path: string, params: Record<string, string>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", scrapingDogKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchWithTimeout(
    url.toString(),
    undefined,
    {
      provider: "scrapingdog",
      timeoutMs: providerTimeoutMs("scrapingdog", 45_000),
      label: `maps-kd:${path}`,
    }
  );
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body };
}

async function mapsSearch(query: string, searchPoint: { lat: number; lng: number }): Promise<MapsHit[]> {
  const params: Record<string, string> = { query };
  params.ll = `@${searchPoint.lat},${searchPoint.lng},${SEARCH_ZOOM}z`;
  const res = await sdGet("google_maps", params);
  if (!res.ok) return [];
  const body = res.body as MapsHit[] | { search_results?: MapsHit[] };
  return Array.isArray(body) ? body : (body?.search_results ?? []);
}

// ---- dated reviews ----
interface RawReview {
  iso_date?: string;
  review_date?: string;
  published_at?: string;
  timestamp?: number;
  relative_date?: string;
  date?: string;
  when?: string;
}

function parseRelative(text: string, now: Date): Date | null {
  const t = text.toLowerCase().trim();
  const m = t.match(/(a|an|\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/);
  if (!m) return null;
  const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
  const mult: Record<string, number> = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: DAY_MS,
    week: 7 * DAY_MS,
    month: 30 * DAY_MS,
    year: 365 * DAY_MS,
  };
  return new Date(now.getTime() - n * mult[m[2]]);
}

function parseReviewDate(raw: RawReview, now: Date): Date | null {
  const iso = raw.iso_date ?? raw.review_date ?? raw.published_at;
  if (typeof iso === "string") {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof raw.timestamp === "number") {
    const ms = raw.timestamp > 1e12 ? raw.timestamp : raw.timestamp * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const rel = raw.relative_date ?? raw.date ?? raw.when;
  if (typeof rel === "string") return parseRelative(rel, now);
  return null;
}

interface Velocity {
  reviews30d: number;
  reviews90d: number;
  reviews365d: number;
  daysSinceLast: number | null;
  newestIso: string | null;
}

async function fetchDatedReviews(dataId: string): Promise<Velocity> {
  const now = new Date();
  const cutoff = now.getTime() - LOOKBACK_DAYS * DAY_MS;
  const dates: number[] = [];
  let nextToken: string | null = null;
  let sortBy = "newestFirst";

  for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
    const params: Record<string, string> = { data_id: dataId, sort_by: sortBy };
    if (nextToken) {
      params.next_page_token = nextToken;
      params.results = "20";
    }
    let res = await sdGet("google_maps/reviews", params);
    if (!res.ok && page === 0 && sortBy === "newestFirst") {
      sortBy = "qualityScore";
      res = await sdGet("google_maps/reviews", { data_id: dataId, sort_by: sortBy });
    }
    if (!res.ok) break;
    const body = res.body as { reviews_results?: RawReview[]; reviews?: RawReview[]; pagination?: { next_page_token?: string } };
    const batch = body?.reviews_results ?? body?.reviews ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    let oldestOnPage: number | null = null;
    for (const r of batch) {
      const d = parseReviewDate(r, now);
      if (!d) continue;
      dates.push(d.getTime());
      if (oldestOnPage == null || d.getTime() < oldestOnPage) oldestOnPage = d.getTime();
    }
    if (sortBy === "newestFirst" && oldestOnPage != null && oldestOnPage < cutoff) break;
    nextToken = body?.pagination?.next_page_token ?? null;
    if (!nextToken) break;
    await sleep(350);
  }

  const count = (days: number) => {
    const c = now.getTime() - days * DAY_MS;
    return dates.filter((t) => t >= c).length;
  };
  const newest = dates.length ? Math.max(...dates) : null;
  return {
    reviews30d: count(30),
    reviews90d: count(90),
    reviews365d: count(365),
    daysSinceLast: newest == null ? null : Math.floor((now.getTime() - newest) / DAY_MS),
    newestIso: newest ? new Date(newest).toISOString().slice(0, 10) : null,
  };
}

// ---- GMB profile ----
function firstArray<T>(...vals: unknown[]): T[] {
  for (const v of vals) if (Array.isArray(v) && v.length) return v as T[];
  return [];
}

interface GmbProfile {
  primaryCategory: string[];
  categories: string[];
  categoryCount: number;
  hasHours: boolean;
  phone: string | null;
  website: string | null;
  address: string | null;
}

async function fetchGmbProfile(placeId: string, hit: MapsHit): Promise<GmbProfile> {
  const details = await sdGet("google_maps/places", { place_id: placeId });
  const raw = (details.ok ? details.body : {}) as Record<string, unknown>;
  const pr = (raw.place_results ?? raw ?? {}) as Record<string, unknown>;
  const typeVal = pr.type;
  const categories = firstArray<string>(
    pr.types,
    pr.categories,
    Array.isArray(typeVal) ? typeVal : typeof typeVal === "string" ? [typeVal] : [],
    hit.type ? [hit.type] : []
  );
  return {
    primaryCategory: categories.slice(0, 15),
    categories: [],
    categoryCount: categories.length,
    hasHours: Boolean(pr.hours ?? pr.working_hours ?? pr.open_state ?? pr.open_hours),
    phone: (pr.phone as string) ?? hit.phone ?? null,
    website: (pr.website as string) ?? hit.website ?? null,
    address: (pr.address as string) ?? hit.address ?? null,
  };
}

// ---- homepage on-page ----
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
function extractTag(html: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const t = stripTags(m[1]);
    if (t) out.push(t);
  }
  return out;
}

async function fetchHtml(website: string): Promise<string | null> {
  try {
    const { safeFetchWebsite, safeReadText } = await import("@/lib/validation/ssrf");
    const res = await safeFetchWebsite(website, 15000);
    if (res.ok) {
      const html = await safeReadText(res);
      if (html && html.length > 500) return html.slice(0, 2_000_000);
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await sdGet("scrape", { url: website, dynamic: "false" });
    if (res.ok) {
      const b = res.body as string | { html?: string; raw?: string };
      const html = typeof b === "string" ? b : (b?.html ?? b?.raw ?? "");
      if (html && html.length > 500) return html;
    }
  } catch {
    /* ignore */
  }
  return null;
}

interface HomeOnPage {
  ok: boolean;
  title?: string | null;
  kwInTitle?: boolean;
  cityInTitle?: boolean;
  kwInH1?: boolean;
  cityInH1?: boolean;
  kwInBody?: boolean;
  cityInBody?: boolean;
}

function analyzeOnPage(html: string | null, cityToken: string, kwTokens: string[]): HomeOnPage {
  if (!html) return { ok: false };
  const title = extractTag(html, "title")[0] ?? null;
  const h1 = extractTag(html, "h1");
  const bodyText = stripTags(html).toLowerCase().slice(0, 20000);
  const titleL = (title ?? "").toLowerCase();
  const h1L = h1.join(" ").toLowerCase();
  const hasCity = (s: string) => (cityToken ? s.includes(cityToken) : false);
  const hasKw = (s: string) => kwTokens.every((t) => s.includes(t));
  return {
    ok: true,
    title,
    kwInTitle: hasKw(titleL),
    cityInTitle: hasCity(titleL),
    kwInH1: hasKw(h1L),
    cityInH1: hasCity(h1L),
    kwInBody: hasKw(bodyText),
    cityInBody: hasCity(bodyText),
  };
}

// ---------------------------------------------------------------------------
// DataForSEO
// ---------------------------------------------------------------------------
async function dfsPost<T>(endpoint: string, body: unknown, timeoutMs = 120_000): Promise<T> {
  const { user, pass } = dfsCreds();
  const res = await fetchWithTimeout(
    `https://api.dataforseo.com/v3/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    {
      provider: "dataforseo",
      timeoutMs: providerTimeoutMs("dataforseo", timeoutMs),
      label: `maps-kd:${endpoint}`,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`DFS HTTP ${res.status}`);
  const task = data.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(task.status_message ?? `DFS task error ${task.status_code}`);
  }
  return data as T;
}

interface RefDomainItem {
  domain?: string;
  rank?: number;
  backlinks?: number;
  backlinks_spam_score?: number;
}
interface RefDomainsAuthority {
  totalDofollowReferringDomains: number;
  fetched: number;
  summary: { strongestDomainRank: number | null; avgTop10DomainRank: number | null; cleanDomains: number };
  error?: string;
}

async function fetchDofollowReferringDomainsCached(
  target: string,
  cache: Map<string, RefDomainsAuthority>
): Promise<RefDomainsAuthority> {
  const key = target.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const result = await fetchDofollowReferringDomains(target);
  cache.set(key, result);
  return result;
}

async function fetchCompetitorAuthorityProfile(
  pageTargetUrl: string,
  rootDomain: string,
  cache: Map<string, RefDomainsAuthority>
): Promise<import("@/lib/maps-difficulty/authority").CompetitorAuthority> {
  const sameTarget = isSameAuthorityTarget(pageTargetUrl, rootDomain);
  const rootRef = await fetchDofollowReferringDomainsCached(rootDomain, cache);
  const pageRef = sameTarget ? rootRef : await fetchDofollowReferringDomainsCached(pageTargetUrl, cache);
  const rootScore = refDomainAuthorityScore(rootRef);
  const pageScore = sameTarget ? rootScore : refDomainAuthorityScore(pageRef);
  return buildCompetitorAuthority({
    pageTargetUrl,
    rootDomain,
    pageRef: pageRef as RefDomainsAuthorityData,
    rootRef: rootRef as RefDomainsAuthorityData,
    pageAuthorityScore: pageScore,
    rootAuthorityScore: rootScore,
    usedSameTargetForPageAndRoot: sameTarget,
  });
}

async function fetchDofollowReferringDomains(domain: string): Promise<RefDomainsAuthority> {
  const data = await dfsPost<{ tasks?: Array<{ result?: Array<{ items?: RefDomainItem[]; total_count?: number }> }> }>(
    "backlinks/referring_domains/live",
    [
      {
        target: domain,
        limit: REF_DOMAIN_LIMIT,
        order_by: ["rank,desc"],
        backlinks_status_type: "live",
        backlinks_filters: ["dofollow", "=", true],
        exclude_internal_backlinks: true,
        rank_scale: "one_thousand",
      },
    ]
  );
  const result = data.tasks?.[0]?.result?.[0];
  const rawItems = result?.items ?? [];
  const items = rawItems.map((item) => ({
    domain: item.domain ?? null,
    rank: typeof item.rank === "number" ? item.rank : null,
    spamScore: typeof item.backlinks_spam_score === "number" ? item.backlinks_spam_score : null,
  }));
  items.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const ranks = items.map((i) => i.rank).filter((r): r is number => r != null);
  const top10 = ranks.slice(0, 10);
  return {
    totalDofollowReferringDomains: result?.total_count ?? items.length,
    fetched: items.length,
    summary: {
      strongestDomainRank: ranks[0] ?? null,
      avgTop10DomainRank: top10.length ? Math.round((top10.reduce((a, b) => a + b, 0) / top10.length) * 10) / 10 : null,
      cleanDomains: items.filter((i) => (i.spamScore ?? 0) <= 10).length,
    },
  };
}

// ---- landing page discovery ----
function isHomepageUrl(u: string): boolean {
  try {
    const p = new URL(u).pathname.replace(/\/+$/, "");
    return p === "" || p === "/" || /^\/(home|index(\.html?)?)$/i.test(p);
  } catch {
    return true;
  }
}
function deriveGeneralLocationUrl(url: string, cityNorm: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  if (segs.length === 0 || !cityNorm) return null;
  let cityIdx = -1;
  for (let i = 0; i < segs.length; i++) if (norm(segs[i]).includes(cityNorm)) cityIdx = i;
  if (cityIdx === -1) return null;
  const junkTokens = ["junk", "hauling", "haul"];
  let keepTo = cityIdx;
  for (let j = cityIdx + 1; j < segs.length; j++) if (junkTokens.some((t) => norm(segs[j]).includes(t))) keepTo = j;
  u.pathname = "/" + segs.slice(0, keepTo + 1).join("/") + "/";
  u.search = "";
  u.hash = "";
  return u.toString();
}

interface SerpResult {
  url: string;
  title: string | null;
  rankAbsolute: number | null;
}
async function siteSearch(domain: string, city: string): Promise<{ keyword: string; results: SerpResult[] }> {
  const keyword = `site:${domain} ${city}`;
  const data = await dfsPost<{
    tasks?: Array<{ result?: Array<{ items?: Array<{ type?: string; url?: string; title?: string; rank_absolute?: number }> }> }>;
  }>("serp/google/organic/live/advanced", [
    { keyword, location_name: "United States", language_code: "en", device: "desktop", os: "windows", depth: 10 },
  ]);
  const items = (data.tasks?.[0]?.result?.[0]?.items ?? []).filter((i) => i.type === "organic" && i.url);
  return {
    keyword,
    results: items.slice(0, 10).map((i) => ({ url: i.url!, title: i.title ?? null, rankAbsolute: i.rank_absolute ?? null })),
  };
}

interface InstantPage {
  ok: boolean;
  url?: string;
  statusCode?: number | null;
  title?: string | null;
  wordCount?: number | null;
  _titleN?: string;
  _h1N?: string;
  _titleL?: string;
  _h1L?: string;
}
async function instantPage(url: string): Promise<InstantPage> {
  const data = await dfsPost<{
    tasks?: Array<{
      result?: Array<{
        items?: Array<{
          url?: string;
          status_code?: number;
          meta?: { title?: string; description?: string; htags?: { h1?: string[]; h2?: string[] }; content?: { plain_text_word_count?: number } };
        }>;
      }>;
    }>;
  }>("on_page/instant_pages", [{ url, accept_language: "en-US", load_resources: false, enable_javascript: false }]);
  const item = data.tasks?.[0]?.result?.[0]?.items?.[0];
  if (!item) return { ok: false };
  const meta = item.meta ?? {};
  const h1 = meta.htags?.h1 ?? [];
  const title = meta.title ?? null;
  return {
    ok: true,
    url: item.url ?? url,
    statusCode: item.status_code ?? null,
    title,
    wordCount: meta.content?.plain_text_word_count ?? null,
    _titleL: (title ?? "").toLowerCase(),
    _h1L: h1.join(" ").toLowerCase(),
    _titleN: norm(title),
    _h1N: norm(h1.join(" ")),
  };
}
function pageIsUsable(page: InstantPage | null): boolean {
  if (!page?.ok) return false;
  const code = page.statusCode;
  if (code != null && (code < 200 || code >= 400)) return false;
  if ((page.wordCount ?? 0) < 40) return false;
  return true;
}
function scoreLocalSignals(page: InstantPage, cityNorm: string, kwTokens: string[]) {
  const hasKw = (s: string) => kwTokens.every((t) => s.includes(t));
  const cityIn = (n: string) => (cityNorm ? n.includes(cityNorm) : false);
  return {
    ok: true,
    url: page.url ?? null,
    title: page.title ?? null,
    wordCount: page.wordCount ?? 0,
    kwInTitle: hasKw(page._titleL ?? ""),
    cityInTitle: cityIn(page._titleN ?? ""),
    kwInH1: hasKw(page._h1L ?? ""),
    cityInH1: cityIn(page._h1N ?? ""),
  };
}

// ---------------------------------------------------------------------------
// public
// ---------------------------------------------------------------------------
export interface MapsDifficultyInput {
  keyword: string;
  lat: number;
  lng: number;
  label: string;
  service?: string;
}

export interface MapsDifficultyResult {
  keyword: string;
  cityLabel: string;
  service: string;
  searchPoint: { lat: number; lng: number };
  generatedAt: string;
  score: MarketScore;
  businesses: EnrichedBusiness[];
}

/**
 * When no explicit service is given, derive it from the keyword by removing the
 * location tokens (city + state) so on-page matching works for any niche —
 * e.g. "plumbers austin tx" + label "Austin, TX" -> "plumbers".
 */
function deriveServiceFromKeyword(keyword: string, label: string): string {
  const stop = new Set(
    label
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
  );
  const kept = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t && !stop.has(t));
  return kept.join(" ").trim() || keyword.trim();
}

export async function runMapsDifficulty(input: MapsDifficultyInput): Promise<MapsDifficultyResult> {
  const keyword = input.keyword.trim();
  const searchPoint = { lat: input.lat, lng: input.lng };
  const cityName = input.label.split(",")[0].replace(/\(.*\)/, "").trim();
  const service = (input.service ?? "").trim() || deriveServiceFromKeyword(keyword, input.label);
  const cityToken = norm(cityName);
  const kwTokens = service.toLowerCase().split(/\s+/).filter(Boolean);

  // 1) Maps search → top 3 with hex data_id
  const results = await mapsSearch(keyword, searchPoint);
  const top = results.filter((r) => r.data_id?.startsWith("0x")).slice(0, TOP_N);
  if (top.length === 0) throw new Error("No usable Maps results for this keyword + search point.");

  const businesses: EnrichedBusiness[] = [];
  const authorityCache = new Map<string, RefDomainsAuthority>();

  for (let i = 0; i < top.length; i++) {
    const hit = top[i];
    const coords = extractCoords(hit);
    const distanceMi = haversineMiles(searchPoint, coords);
    const website = hit.website ?? null;
    const domain = normalizeDomain(website);

    const biz: EnrichedBusiness = {
      rank: i + 1,
      name: hit.title ?? `Result #${i + 1}`,
      placeId: hit.place_id ?? null,
      rating: hit.rating ?? null,
      totalReviews: hit.reviews ?? null,
      lat: coords.lat,
      lng: coords.lng,
      distanceMi,
      distanceFromSearchPointMiles: distanceMi,
      website,
      domain,
    };

    // 2) dated review velocity
    if (hit.data_id) {
      try {
        const vel = await fetchDatedReviews(hit.data_id);
        biz.reviews30d = vel.reviews30d;
        biz.reviews90d = vel.reviews90d;
        biz.reviews365d = vel.reviews365d;
        biz.daysSinceLast = vel.daysSinceLast;
      } catch {
        /* leave review velocity at defaults */
      }
    }

    // 3) GMB profile
    if (hit.place_id) {
      try {
        biz.gmb = await fetchGmbProfile(hit.place_id, hit);
      } catch (e) {
        biz.gmb = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    // 4) homepage on-page
    if (website) {
      try {
        const html = await fetchHtml(website);
        biz.onPage = analyzeOnPage(html, cityToken, kwTokens);
      } catch {
        biz.onPage = { ok: false };
      }
    }

    // 5) dedicated local landing page discovery (before authority — page target depends on this)
    if (domain) {
      const homepage = website ?? `https://${domain}`;
      try {
        const serp = await siteSearch(domain, cityName);
        const topResult = serp.results[0] ?? null;
        let dedicatedLocalPage = false;
        let landingUrl: string | null = homepage;
        let source = "homepage_fallback";
        let onPageLocal: ReturnType<typeof scoreLocalSignals> | null = null;

        if (topResult && !isHomepageUrl(topResult.url)) {
          const general = deriveGeneralLocationUrl(topResult.url, cityToken);
          const chosen = general ?? topResult.url;
          const collapsed = !!general && norm(general) !== norm(topResult.url);
          let page: InstantPage | null = null;
          try {
            page = await instantPage(chosen);
          } catch {
            /* ignore */
          }
          if (pageIsUsable(page)) {
            onPageLocal = scoreLocalSignals(page!, cityToken, kwTokens);
            landingUrl = onPageLocal.url ?? chosen;
            source = collapsed ? "derived_general_page" : "serp_site_search";
            dedicatedLocalPage = true;
          }
        }
        biz.landing = { dedicatedLocalPage, landingUrl, source, onPage: dedicatedLocalPage ? onPageLocal : null };
      } catch (e) {
        biz.landing = { dedicatedLocalPage: false, landingUrl: homepage, source: "error", onPage: null };
        void e;
      }
    }

    // 6) page + root dofollow referring domains (cached per target)
    const pageTarget = resolvePageTargetUrl(biz.landing?.landingUrl, website, domain);
    if (domain && pageTarget) {
      try {
        const profile = await fetchCompetitorAuthorityProfile(pageTarget, domain, authorityCache);
        biz.authority = profile;
        const rootCached = authorityCache.get(domain.toLowerCase());
        biz.refDomainsAuthority = {
          totalDofollowReferringDomains: profile.rootDofollowRefDomains,
          fetched: rootCached?.fetched ?? 0,
          summary: {
            cleanDomains: rootCached?.summary.cleanDomains ?? 0,
            strongestDomainRank: profile.rootStrongestReferringDomainRank,
          },
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        biz.authority = {
          pageTargetUrl: pageTarget,
          rootDomain: domain,
          pageRefDomains: 0,
          pageDofollowRefDomains: 0,
          pageCleanDofollowRefDomains: 0,
          pageAuthorityScore: 0,
          rootRefDomains: 0,
          rootDofollowRefDomains: 0,
          rootCleanDofollowRefDomains: 0,
          rootAuthorityScore: 0,
          combinedAuthorityScore: 0,
          authoritySourceType: "root_only",
          usedSameTargetForPageAndRoot: isSameAuthorityTarget(pageTarget, domain),
          pageStrongestReferringDomainRank: null,
          rootStrongestReferringDomainRank: null,
          error: message,
        };
        biz.refDomainsAuthority = { error: message };
      }
    }

    businesses.push(biz);
  }

  // within-pack proximity order (1 = closest)
  const proxSorted = [...businesses]
    .filter((b) => b.distanceMi != null)
    .sort((a, b) => (a.distanceMi as number) - (b.distanceMi as number));
  proxSorted.forEach((b, idx) => {
    b.proximityOrder = idx + 1;
  });

  // shared domains within the pack → franchise/multi-location flag
  const domainCounts = new Map<string, number>();
  for (const b of businesses) if (b.domain) domainCounts.set(b.domain, (domainCounts.get(b.domain) ?? 0) + 1);
  const sharedDomains = new Set([...domainCounts.entries()].filter(([, n]) => n > 1).map(([d]) => d));

  const normalized = businesses.map((b) => normalizeBusiness(b, { sharedDomains, service }));
  const score = scoreMarket(normalized, { keyword, searchPoint, cityLabel: cityName });

  return {
    keyword,
    cityLabel: cityName,
    service,
    searchPoint,
    generatedAt: new Date().toISOString(),
    score,
    businesses,
  };
}
