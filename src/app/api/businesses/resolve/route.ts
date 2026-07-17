import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { resolveBusinessSchema } from "@/lib/validation/schemas";
import { myBusinessInfo } from "@/lib/providers/dataforseo";
import { mapsSearch } from "@/lib/providers/scrapingdog";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = resolveBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { name, city, state, website } = parsed.data;
    const keyword = city ? `${name} ${city}` : name;
    const candidates: Array<Record<string, unknown>> = [];

    try {
      const dfsResults = await myBusinessInfo({
        keyword,
        city,
        state,
        country: "United States",
        organizationId: auth.organizationId,
      });
      for (const item of dfsResults.slice(0, 10)) {
        candidates.push({
          name: item.title ?? name,
          address: item.address,
          place_id: item.place_id,
          cid: item.cid,
          category: item.category,
          rating: item.rating?.value,
          review_count: item.rating?.votes_count,
          phone: item.phone,
          lat: item.latitude,
          lng: item.longitude,
          website: item.url ?? website,
          source: "dataforseo",
        });
      }
    } catch {
      /* fallback */
    }

    if (candidates.length === 0) {
      try {
        const sdResults = await mapsSearch({ query: keyword, organizationId: auth.organizationId });
        for (const item of sdResults.slice(0, 10)) {
          candidates.push({
            name: item.title ?? name,
            address: item.address,
            place_id: item.place_id,
            cid: item.data_id,
            category: item.type,
            rating: item.rating,
            review_count: item.reviews,
            phone: item.phone,
            lat: item.gps_coordinates?.latitude,
            lng: item.gps_coordinates?.longitude,
            website: item.website ?? website,
            source: "scrapingdog",
          });
        }
      } catch {
        /* no results */
      }
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    return httpErrorFromException(err, "Resolve failed");
  }
}
