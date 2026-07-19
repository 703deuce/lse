/**
 * Compare DataForSEO vs ScrapingDog vs Bright Data ranks at the same grid coordinates.
 * Runs one cell at a time, providers sequentially per cell (350ms pacing).
 *
 * Usage: node scripts/compare-grid-providers.mjs [scanId] [--out dir]
 *
 * Env: DATAFORSEO_*, SCRAPINGDOG_API_KEY, BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const SCAN_ID = args.find((a) => !a.startsWith("--")) || "096bb476-12d8-4b4a-8671-677eab928ea4";
const outIdx = args.indexOf("--out");
const OUT_DIR = outIdx >= 0 ? resolve(args[outIdx + 1] || "scripts/output") : resolve(ROOT, "scripts/output");
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
const ZOOM = 17;
const KEYWORD = "junk removal woodbridge";
const CELL_DELAY_MS = Number(process.env.GRID_MAPS_CELL_DELAY_MS ?? 350);

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(ROOT, file), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* optional */
    }
  }
}

loadEnv();

const DFS_USER = process.env.DATAFORSEO_USERNAME;
const DFS_PASS = process.env.DATAFORSEO_PASSWORD;
const SD_KEY = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
const BD_KEY = process.env.BRIGHTDATA_API_KEY;
let BD_ZONE = process.env.BRIGHTDATA_ZONE ?? process.env.BRIGHTDATA_SERP_ZONE;

if (!BD_KEY) {
  console.error("Missing BRIGHTDATA_API_KEY");
  process.exit(1);
}
if (!DFS_USER || !DFS_PASS) {
  console.error("Missing DATAFORSEO credentials");
  process.exit(1);
}
if (!SD_KEY) {
  console.error("Missing SCRAPINGDOG_API_KEY");
  process.exit(1);
}

async function ensureBrightDataZone() {
  if (BD_ZONE?.trim()) return BD_ZONE.trim();
  const res = await fetch("https://api.brightdata.com/zone/get_active_zones", {
    headers: { Authorization: `Bearer ${BD_KEY}` },
  });
  const zones = res.ok ? await res.json() : [];
  const serp = zones.find((z) => /serp|unlocker/i.test(z.type ?? "") || /serp/i.test(z.name ?? ""));
  BD_ZONE = serp?.name ?? zones[0]?.name;
  if (!BD_ZONE) {
    console.error("Missing BRIGHTDATA_ZONE — create a SERP API zone at https://brightdata.com/cp/zones");
    process.exit(1);
  }
  console.log(`Using Bright Data zone: ${BD_ZONE}${serp ? "" : " (warning: not a SERP zone — ranked JSON may be unavailable)"}`);
  return BD_ZONE;
}

const dfsAuth = "Basic " + Buffer.from(`${DFS_USER}:${DFS_PASS}`).toString("base64");

function normalizeCid(cid) {
  if (!cid) return null;
  return cid.replace(/^cid:/i, "").trim().toLowerCase();
}

function matchRank(items, target, getFields) {
  const targetCid = normalizeCid(target.cid);
  const targetPlace = target.place_id?.trim();
  const targetName = target.name?.toLowerCase().trim();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const f = getFields(item, i);
    if (targetCid && f.cid && normalizeCid(f.cid) === targetCid) return { rank: f.rank, reason: "cid" };
    if (targetPlace && f.place_id === targetPlace) return { rank: f.rank, reason: "place_id" };
    if (targetName && f.title) {
      const t = f.title.toLowerCase();
      if (t.includes(targetName) || targetName.includes(t)) return { rank: f.rank, reason: "name" };
    }
  }
  return { rank: null, reason: items.length ? `not_in_top_${items.length}` : "no_results" };
}

async function dfsCell(lat, lng) {
  const body = [{
    keyword: KEYWORD.trim(),
    // DataForSEO docs require zoom with a trailing "z" (e.g. 17z).
    location_coordinate: `${lat},${lng},${ZOOM}z`,
    language_code: "en",
    device: "mobile",
    os: "android",
    depth: 20,
    search_this_area: true,
    search_places: true,
    se_domain: "google.com",
  }];
  let res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: { Authorization: dfsAuth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = await res.json();
  let task = data.tasks?.[0];
  if (task?.status_code === 40102) {
    body[0].search_this_area = false;
    res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: { Authorization: dfsAuth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
    task = data.tasks?.[0];
  }
  const items = task?.result?.[0]?.items ?? [];
  return {
    items,
    mode: body[0].search_this_area ? "sta=true" : "fallback",
    status: task?.status_code,
    count: items.length,
    error: task?.status_code >= 40000 ? task?.status_message : null,
  };
}

async function sdCell(lat, lng) {
  const url = new URL("https://api.scrapingdog.com/google_maps");
  url.searchParams.set("api_key", SD_KEY);
  url.searchParams.set("query", KEYWORD.trim());
  url.searchParams.set("ll", `@${lat},${lng},${ZOOM}z`);
  url.searchParams.set("domain", "google.com");
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "us");
  const res = await fetch(url);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.search_results ?? [];
  return { items, status: res.status, count: items.length, error: res.ok ? null : JSON.stringify(data).slice(0, 200) };
}

async function bdCell(lat, lng) {
  const q = encodeURIComponent(KEYWORD.trim()).replace(/%20/g, "+");
  const mapsUrl =
    `https://www.google.com/maps/search/${q}/@${lat},${lng},${ZOOM}z?brd_json=1&gl=us&hl=en`;
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BD_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone: BD_ZONE,
      url: mapsUrl,
      format: "raw",
      data_format: "parsed_light",
    }),
  });
  const text = await res.text();
  let items = [];
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) items = data;
    else if (data.organic?.length) items = data.organic;
    else if (typeof data.body === "string") {
      const inner = JSON.parse(data.body);
      items = inner.organic ?? [];
    } else if (data.place) items = [data.place];
  } catch {
    /* empty */
  }
  return {
    items,
    status: res.status,
    count: items.length,
    error: res.ok ? null : text.slice(0, 200),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countMatches(rows, a, b) {
  let same = 0;
  let diff = 0;
  for (const r of rows) {
    const x = r[a]?.rank;
    const y = r[b]?.rank;
    if (typeof x === "number" && typeof y === "number") {
      if (x === y) same++;
      else diff++;
    }
  }
  return { same, diff };
}

async function loadGridContext() {
  try {
    const statusRes = await fetch(`${APP}/api/scans/${SCAN_ID}/status`);
    if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);
    const status = await statusRes.json();
    const debugRes = await fetch(`${APP}/api/scans/${SCAN_ID}/debug`);
    if (!debugRes.ok) throw new Error(`debug ${debugRes.status}`);
    const debug = await debugRes.json();
    return {
      business: {
        name: status.business?.name,
        cid: status.business?.cid,
        place_id: status.business?.place_id,
      },
      cells: debug.cells,
      source: `api:${SCAN_ID}`,
    };
  } catch (err) {
    const fallbackPath = resolve(
      ROOT,
      "scripts/output/grid-provider-comparison-eaf2a843-3cb2-4af4-a78d-6318d41c5ceb.json"
    );
    const fallback = JSON.parse(readFileSync(fallbackPath, "utf8"));
    console.warn(`API unavailable (${err instanceof Error ? err.message : err}), using grid from ${fallbackPath}`);
    return {
      business: fallback.business,
      cells: fallback.cells.map((c) => ({
        gridLabel: c.gridLabel,
        lat: c.lat,
        lng: c.lng,
        distanceFromCenterM: c.distanceFromCenterM ?? null,
      })),
      source: fallbackPath,
    };
  }
}

async function main() {
  await ensureBrightDataZone();

  const { business, cells, source } = await loadGridContext();

  console.log(`\n3-provider comparison — scan ${SCAN_ID}`);
  console.log(`Grid source: ${source}`);
  console.log(`Business: ${business.name}`);
  console.log(`Keyword: "${KEYWORD}" · zoom ${ZOOM}z · sequential same-run (${CELL_DELAY_MS}ms between calls)\n`);
  console.log(
    "Cell".padEnd(6) +
      "DFS#".padStart(5) +
      " SD#".padStart(5) +
      " BD#".padStart(5) +
      "  DFS".padEnd(10) +
      "  SD".padStart(4) +
      "  BD".padStart(4)
  );
  console.log("-".repeat(48));

  const rows = [];

  for (const cell of cells) {
    const dfs = await dfsCell(cell.lat, cell.lng);
    await sleep(CELL_DELAY_MS);
    const sd = await sdCell(cell.lat, cell.lng);
    await sleep(CELL_DELAY_MS);
    const bd = await bdCell(cell.lat, cell.lng);
    await sleep(CELL_DELAY_MS);

    const dfsMatch = matchRank(dfs.items, business, (item, i) => ({
      rank: item.rank_group ?? item.rank_absolute ?? i + 1,
      cid: item.cid,
      place_id: item.place_id,
      title: item.title,
    }));

    const sdMatch = matchRank(sd.items, business, (item, i) => ({
      rank: i + 1,
      cid: item.data_id,
      place_id: item.place_id,
      title: item.title,
    }));

    const bdMatch = matchRank(bd.items, business, (item, i) => ({
      rank: item.rank ?? item.global_rank ?? i + 1,
      cid: item.map_id ?? item.fid,
      place_id: item.map_id_encoded,
      title: item.title,
    }));

    const dfsR = dfsMatch.rank ?? "—";
    const sdR = sdMatch.rank ?? "—";
    const bdR = bdMatch.rank ?? "—";

    const flag =
      dfsR === sdR && sdR === bdR ? "" :
      dfsR !== "—" && sdR !== "—" && bdR !== "—" ? " *" : "";

    console.log(
      cell.gridLabel.padEnd(6) +
        String(dfsR).padStart(5) +
        String(sdR).padStart(5) +
        String(bdR).padStart(5) +
        `  ${dfs.mode}`.padEnd(10) +
        String(dfs.count).padStart(4) +
        String(sd.count).padStart(4) +
        String(bd.count).padStart(4) +
        flag
    );

    rows.push({
      gridLabel: cell.gridLabel,
      lat: cell.lat,
      lng: cell.lng,
      distanceFromCenterM: cell.distanceFromCenterM ?? null,
      dataforseo: {
        rank: dfsMatch.rank,
        matchReason: dfsMatch.reason,
        searchThisAreaMode: dfs.mode,
        resultCount: dfs.count,
        error: dfs.error,
      },
      scrapingdog: {
        rank: sdMatch.rank,
        matchReason: sdMatch.reason,
        resultCount: sd.count,
        httpStatus: sd.status,
        error: sd.error,
      },
      brightdata: {
        rank: bdMatch.rank,
        matchReason: bdMatch.reason,
        resultCount: bd.count,
        httpStatus: bd.status,
        zone: BD_ZONE,
        error: bd.error,
      },
      appStoredRank: cell.targetRank,
      allThreeMatch: dfsR === sdR && sdR === bdR && typeof dfsR === "number",
    });
  }

  const dfsSd = countMatches(rows, "dataforseo", "scrapingdog");
  const sdBd = countMatches(rows, "scrapingdog", "brightdata");
  const dfsBd = countMatches(rows, "dataforseo", "brightdata");
  const all3 = rows.filter((r) => r.allThreeMatch).length;

  console.log("-".repeat(48));
  console.log(`All 3 match: ${all3}/${cells.length}`);
  console.log(`DFS vs SD: ${dfsSd.same}/${cells.length} exact · ${dfsSd.diff} differ`);
  console.log(`SD vs BD:  ${sdBd.same}/${cells.length} exact · ${sdBd.diff} differ`);
  console.log(`DFS vs BD: ${dfsBd.same}/${cells.length} exact · ${dfsBd.diff} differ`);

  const report = {
    generatedAt: new Date().toISOString(),
    scanId: SCAN_ID,
    gridSource: source,
    business,
    mode: "sequential_same_run",
    cellDelayMs: CELL_DELAY_MS,
    settings: {
      keyword: KEYWORD.trim(),
      zoom: ZOOM,
      device: "mobile",
      os: "android",
      depth: 20,
      dataforseo: { endpoint: "serp/google/maps/live/advanced", search_this_area: "true then fallback" },
      scrapingdog: { endpoint: "google_maps", llFormat: `@lat,lng,${ZOOM}z` },
      brightdata: { endpoint: "api.brightdata.com/request", zone: BD_ZONE, format: "raw", data_format: "parsed_light" },
    },
    summary: {
      totalCells: cells.length,
      allThreeMatch: all3,
      dfsVsSd: dfsSd,
      sdVsBd: sdBd,
      dfsVsBd: dfsBd,
    },
    cells: rows,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const base = `grid-provider-comparison-3way-same-run`;
  const jsonPath = join(OUT_DIR, `${base}.json`);
  const csvPath = join(OUT_DIR, `${base}.csv`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const csvHeader = [
    "gridLabel", "lat", "lng",
    "dfs_rank", "sd_rank", "bd_rank",
    "dfs_count", "sd_count", "bd_count",
    "all_three_match", "app_stored_rank",
  ].join(",");

  const csvLines = rows.map((r) =>
    [
      r.gridLabel, r.lat, r.lng,
      r.dataforseo.rank ?? "", r.scrapingdog.rank ?? "", r.brightdata.rank ?? "",
      r.dataforseo.resultCount, r.scrapingdog.resultCount, r.brightdata.resultCount,
      r.allThreeMatch, r.appStoredRank ?? "",
    ].join(",")
  );
  writeFileSync(csvPath, [csvHeader, ...csvLines].join("\n"), "utf8");

  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
