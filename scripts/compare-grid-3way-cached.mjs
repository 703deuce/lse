/**
 * 3-way compare: reuse cached DFS + ScrapingDog from prior run, fetch Bright Data fresh.
 * Usage: node scripts/compare-grid-3way-cached.mjs [cacheJsonPath]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(process.cwd());
const CACHE_PATH =
  process.argv[2] ||
  resolve(ROOT, "scripts/output/grid-provider-comparison-eaf2a843-3cb2-4af4-a78d-6318d41c5ceb.json");
const OUT_DIR = resolve(ROOT, "scripts/output");
const ZOOM = 17;
const KEYWORD = "junk removal woodbridge";
const CELL_DELAY_MS = Number(process.env.SCRAPINGDOG_MAPS_CELL_DELAY_MS ?? 350);

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

const BD_KEY = process.env.BRIGHTDATA_API_KEY;
const BD_ZONE = process.env.BRIGHTDATA_ZONE ?? "serp_api1";

if (!BD_KEY) {
  console.error("Missing BRIGHTDATA_API_KEY");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeCid(cid) {
  if (!cid) return null;
  return cid.replace(/^cid:/i, "").trim().toLowerCase();
}

function matchRank(items, target) {
  const targetCid = normalizeCid(target.cid);
  const targetPlace = target.place_id?.trim();
  const targetName = target.name?.toLowerCase().trim();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rank = item.rank ?? item.global_rank ?? i + 1;
    const cid = item.map_id ?? item.fid;
    const place_id = item.map_id_encoded;
    const title = item.title;
    if (targetCid && cid && normalizeCid(cid) === targetCid) return { rank, reason: "cid" };
    if (targetPlace && place_id === targetPlace) return { rank, reason: "place_id" };
    if (targetName && title) {
      const t = title.toLowerCase();
      if (t.includes(targetName) || targetName.includes(t)) return { rank, reason: "name" };
    }
  }
  return { rank: null, reason: items.length ? `not_in_top_${items.length}` : "no_results" };
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
    }
  } catch {
    /* empty */
  }
  return {
    items,
    status: res.status,
    count: items.length,
    error: res.ok && items.length ? null : text.slice(0, 200),
  };
}

function getCachedDfs(cell) {
  if (cell.dataforseo?.rank != null) return cell.dataforseo;
  return {
    rank: cell.dfsRank ?? cell.dataforseo_rank ?? null,
    matchReason: cell.dfsMatch ?? "cached",
    resultCount: cell.dfsCount ?? cell.dataforseo_results ?? null,
    searchThisAreaMode: cell.dfsMode ?? null,
  };
}

function getCachedSd(cell) {
  if (cell.scrapingdog?.rank != null) return cell.scrapingdog;
  return {
    rank: cell.sdRank ?? cell.scrapingdog_rank ?? null,
    matchReason: cell.sdMatch ?? "cached",
    resultCount: cell.sdCount ?? cell.scrapingdog_results ?? null,
  };
}

function countPair(rows, aKey, bKey) {
  let same = 0;
  let diff = 0;
  for (const r of rows) {
    const x = r[aKey]?.rank;
    const y = r[bKey]?.rank;
    if (typeof x === "number" && typeof y === "number") {
      if (x === y) same++;
      else diff++;
    }
  }
  return { same, diff };
}

async function main() {
  const cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  const business = cache.business;
  const cells = cache.cells;

  console.log(`\n3-way compare (cached DFS+SD, live Bright Data)`);
  console.log(`Cache: ${CACHE_PATH}`);
  console.log(`Business: ${business.name} · zone ${BD_ZONE}\n`);
  console.log(
    "Cell".padEnd(6) +
      "DFS#".padStart(5) +
      " SD#".padStart(5) +
      " BD#".padStart(5) +
      "  BD cnt".padStart(7)
  );
  console.log("-".repeat(40));

  const rows = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const dfs = getCachedDfs(cell);
    const sd = getCachedSd(cell);

    const bd = await bdCell(cell.lat, cell.lng);
    const bdMatch = matchRank(bd.items, business);

    const dfsR = dfs.rank ?? "—";
    const sdR = sd.rank ?? "—";
    const bdR = bdMatch.rank ?? "—";
    const flag =
      dfsR === sdR && sdR === bdR ? "" :
      dfsR !== "—" && sdR !== "—" && bdR !== "—" ? " *" : "";

    console.log(
      cell.gridLabel.padEnd(6) +
        String(dfsR).padStart(5) +
        String(sdR).padStart(5) +
        String(bdR).padStart(5) +
        String(bd.count).padStart(7) +
        flag
    );

    rows.push({
      gridLabel: cell.gridLabel,
      lat: cell.lat,
      lng: cell.lng,
      distanceFromCenterM: cell.distanceFromCenterM ?? null,
      dataforseo: { ...dfs, cached: true, source: CACHE_PATH },
      scrapingdog: { ...sd, cached: true, source: CACHE_PATH },
      brightdata: {
        rank: bdMatch.rank,
        matchReason: bdMatch.reason,
        resultCount: bd.count,
        httpStatus: bd.status,
        zone: BD_ZONE,
        error: bd.error,
        top3: bd.items.slice(0, 3).map((item, idx) => ({
          rank: item.rank ?? item.global_rank ?? idx + 1,
          title: item.title,
          place_id: item.map_id_encoded ?? null,
        })),
      },
      allThreeMatch:
        typeof dfs.rank === "number" &&
        dfs.rank === sd.rank &&
        sd.rank === bdMatch.rank,
    });

    if (i < cells.length - 1) await sleep(CELL_DELAY_MS);
  }

  const dfsSd = countPair(rows, "dataforseo", "scrapingdog");
  const sdBd = countPair(rows, "scrapingdog", "brightdata");
  const dfsBd = countPair(rows, "dataforseo", "brightdata");
  const all3 = rows.filter((r) => r.allThreeMatch).length;

  console.log("-".repeat(40));
  console.log(`All 3 match: ${all3}/${cells.length}`);
  console.log(`DFS vs SD (cached): ${dfsSd.same}/${cells.length} exact`);
  console.log(`SD vs BD (live):    ${sdBd.same}/${cells.length} exact`);
  console.log(`DFS vs BD:          ${dfsBd.same}/${cells.length} exact`);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "cached_dfs_sd_live_brightdata",
    cacheSource: CACHE_PATH,
    business,
    settings: {
      keyword: KEYWORD,
      zoom: ZOOM,
      brightdata: { zone: BD_ZONE, format: "raw", data_format: "parsed_light" },
      dataforseo: cache.settings?.dataforseo ?? "cached",
      scrapingdog: cache.settings?.scrapingdog ?? "cached",
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
  const base = "grid-provider-comparison-3way-cached";
  const jsonPath = join(OUT_DIR, `${base}.json`);
  const csvPath = join(OUT_DIR, `${base}.csv`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const csvHeader =
    "gridLabel,lat,lng,dfs_rank,sd_rank,bd_rank,dfs_count,sd_count,bd_count,all_three_match";
  const csvLines = rows.map((r) =>
    [
      r.gridLabel,
      r.lat,
      r.lng,
      r.dataforseo.rank ?? "",
      r.scrapingdog.rank ?? "",
      r.brightdata.rank ?? "",
      r.dataforseo.resultCount ?? "",
      r.scrapingdog.resultCount ?? "",
      r.brightdata.resultCount ?? "",
      r.allThreeMatch,
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
