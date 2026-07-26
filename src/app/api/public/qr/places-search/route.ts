import { NextResponse } from "next/server";
import { myBusinessInfo } from "@/lib/providers/dataforseo";
import { mapsSearch } from "@/lib/providers/scrapingdog";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

export type PublicPlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-qr-places:${ip}`,
      maxPerWindow: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many business searches from this network. Try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as { query?: string };
    const query = (body.query ?? "").trim();
    if (query.length < 2) {
      return NextResponse.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
    }
    if (query.length > 120) {
      return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
    }

    const candidates: PublicPlaceCandidate[] = [];
    const seen = new Set<string>();

    try {
      const dfsResults = await myBusinessInfo({
        keyword: query,
        country: "United States",
      });
      for (const item of dfsResults.slice(0, 8)) {
        const placeId = (item.place_id ?? "").trim();
        if (!placeId || seen.has(placeId)) continue;
        seen.add(placeId);
        candidates.push({
          place_id: placeId,
          name: item.title ?? query,
          address: item.address ?? "",
          rating: item.rating?.value,
          review_count: item.rating?.votes_count,
        });
      }
    } catch {
      /* fallback */
    }

    if (candidates.length === 0) {
      try {
        const sdResults = await mapsSearch({ query });
        for (const item of sdResults.slice(0, 8)) {
          const placeId = (item.place_id ?? "").trim();
          if (!placeId || seen.has(placeId)) continue;
          seen.add(placeId);
          candidates.push({
            place_id: placeId,
            name: item.title ?? query,
            address: item.address ?? "",
            rating: item.rating,
            review_count: item.reviews,
          });
        }
      } catch {
        /* no results */
      }
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    return httpErrorFromException(err, "Place search failed");
  }
}
