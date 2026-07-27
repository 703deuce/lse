import { NextResponse } from "next/server";
import { fetchMapsResults } from "@/lib/keyword-tracker/rank-check";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { mapsSearch } from "@/lib/providers/scrapingdog";
import { myBusinessInfo } from "@/lib/providers/dataforseo";
import { generateGrid, computeAggregateMetrics } from "@/lib/maps/grid";
import { milesToMeters } from "@/lib/maps/grid-metrics";
import { publicToolCorsHeaders } from "@/lib/public/cors";
import { assertRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function resolveCoords(params: {
  placeId: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ lat: number; lng: number } | null> {
  if (
    typeof params.lat === "number" &&
    typeof params.lng === "number" &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng)
  ) {
    return { lat: params.lat, lng: params.lng };
  }

  try {
    const results = await withTimeout(mapsSearch({ query: params.name }), 8000);
    const match =
      results.find((r) => r.place_id === params.placeId) ??
      results.find((r) => r.gps_coordinates?.latitude != null) ??
      results[0];
    const lat = match?.gps_coordinates?.latitude;
    const lng = match?.gps_coordinates?.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
  } catch {
    /* DFS fallback */
  }

  try {
    const dfs = await withTimeout(
      myBusinessInfo({
        keyword: params.name,
        city: null,
        state: null,
        country: "United States",
        placeId: params.placeId,
      }),
      8000
    );
    const match = dfs.find((r) => r.place_id === params.placeId) ?? dfs[0];
    if (match && typeof match.latitude === "number" && typeof match.longitude === "number") {
      return { lat: match.latitude, lng: match.longitude };
    }
  } catch {
    /* no coords */
  }

  return null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicToolCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = publicToolCorsHeaders(request.headers.get("origin"));
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-maps-rank:${ip}`,
      maxPerWindow: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Free check limit reached for this network. Sign up for full grid scans." },
        { status: 429, headers }
      );
    }

    const body = (await request.json()) as {
      keyword?: string;
      placeId?: string;
      name?: string;
      address?: string;
      lat?: number | null;
      lng?: number | null;
    };

    const keyword = String(body.keyword ?? "").trim();
    const placeId = String(body.placeId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();

    if (keyword.length < 2 || keyword.length > 120) {
      return NextResponse.json(
        { error: "Enter a keyword between 2 and 120 characters." },
        { status: 400, headers }
      );
    }
    if (!placeId || !name) {
      return NextResponse.json(
        { error: "Select a Google Business Profile to check." },
        { status: 400, headers }
      );
    }

    const coords = await resolveCoords({
      placeId,
      name,
      lat: body.lat,
      lng: body.lng,
    });
    if (!coords) {
      return NextResponse.json(
        { error: "Could not locate this business on the map. Try a more specific name." },
        { status: 400, headers }
      );
    }

    const points = generateGrid({
      centerLat: coords.lat,
      centerLng: coords.lng,
      gridSize: 3,
      radiusMeters: milesToMeters(1),
    });

    const cellResults = await mapPool(points, 3, async (point) => {
      try {
        const { items } = await fetchMapsResults({
          keyword,
          lat: point.lat,
          lng: point.lng,
        });
        const match = matchTargetInResults(items, { name, place_id: placeId }, items.length);
        return {
          label: point.label,
          row: point.row,
          col: point.col,
          lat: point.lat,
          lng: point.lng,
          rank: match.found ? match.rank : null,
          found: match.found,
          top_results: items.slice(0, 5).map((item, index) => ({
            rank: index + 1,
            name: item.title ?? "Unknown",
            is_you: Boolean(item.place_id && item.place_id === placeId),
          })),
        };
      } catch {
        return {
          label: point.label,
          row: point.row,
          col: point.col,
          lat: point.lat,
          lng: point.lng,
          rank: null,
          found: false,
          top_results: [] as { rank: number; name: string; is_you: boolean }[],
        };
      }
    });

    const metrics = computeAggregateMetrics(cellResults.map((c) => c.rank));
    const center = cellResults.find((c) => c.row === 1 && c.col === 1) ?? cellResults[4];
    const topCompetitors =
      center?.top_results?.filter((r) => !r.is_you).slice(0, 5) ??
      cellResults.flatMap((c) => c.top_results).filter((r) => !r.is_you).slice(0, 5);

    return NextResponse.json(
      {
        keyword,
        business: { name, place_id: placeId, address },
        center: coords,
        grid_size: 3,
        cells: cellResults,
        average_rank: metrics.averageRank,
        visibility_score: metrics.visibilityScore,
        top3_cells: metrics.top3Cells,
        not_found_cells: metrics.notFoundCells,
        top_competitors: topCompetitors,
        limited: true,
        upgrade_hint:
          "Free checks use a 3×3 grid. Sign up for larger area scans, history, and keyword tracking.",
      },
      { headers }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not check rankings right now. Try again in a moment." },
      { status: 500, headers }
    );
  }
}
