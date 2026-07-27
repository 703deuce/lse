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
  lat?: number;
  lng?: number;
};

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

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-qr-places:${ip}`,
      maxPerWindow: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many business searches from this network. Try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as {
      query?: string;
      city?: string;
      state?: string;
    };
    const query = (body.query ?? "").trim();
    const city = (body.city ?? "").trim();
    const state = (body.state ?? "").trim();
    if (query.length < 2) {
      return NextResponse.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
    }
    if (query.length > 120) {
      return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
    }

    const locationBits = [city, state].filter(Boolean).join(", ");
    const mapsQuery = locationBits ? `${query} ${locationBits}` : query;

    const candidates: PublicPlaceCandidate[] = [];
    const seen = new Set<string>();

    const push = (item: {
      place_id?: string | null;
      name: string;
      address?: string;
      rating?: number;
      review_count?: number;
      lat?: number;
      lng?: number;
    }) => {
      const placeId = (item.place_id ?? "").trim();
      if (!placeId || seen.has(placeId)) return;
      seen.add(placeId);
      candidates.push({
        place_id: placeId,
        name: item.name,
        address: item.address ?? "",
        rating: item.rating,
        review_count: item.review_count,
        lat: Number.isFinite(item.lat) ? item.lat : undefined,
        lng: Number.isFinite(item.lng) ? item.lng : undefined,
      });
    };

    // ScrapingDog first — much faster than DataForSEO live for typeahead.
    try {
      const sdResults = await withTimeout(mapsSearch({ query: mapsQuery }), 8000);
      for (const item of sdResults.slice(0, 8)) {
        push({
          place_id: item.place_id,
          name: item.title ?? query,
          address: item.address,
          rating: item.rating,
          review_count: item.reviews,
          lat: item.gps_coordinates?.latitude,
          lng: item.gps_coordinates?.longitude,
        });
      }
    } catch {
      /* try DFS */
    }

    // Short DFS fallback only if ScrapingDog returned nothing.
    if (candidates.length === 0) {
      try {
        const dfsResults = await withTimeout(
          myBusinessInfo({
            keyword: query,
            city: city || null,
            state: state || null,
            country: "United States",
          }),
          6000
        );
        for (const item of dfsResults.slice(0, 8)) {
          push({
            place_id: item.place_id,
            name: item.title ?? query,
            address: item.address,
            rating: item.rating?.value,
            review_count: item.rating?.votes_count,
            lat: item.latitude,
            lng: item.longitude,
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
