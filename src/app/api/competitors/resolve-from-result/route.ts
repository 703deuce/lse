import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { entityKeyFromRawResult, rawResultToProfile } from "@/lib/competitors/resolve";
import { normalizeDomain } from "@/lib/competitors/resolve";
import type { StoredCompetitor } from "@/lib/maps/grid-entity";

const schema = z.object({
  businessId: z.string().uuid(),
  scanId: z.string().uuid().optional(),
  rawResult: z.object({
    name: z.string().optional(),
    cid: z.string().optional().nullable(),
    place_id: z.string().optional().nullable(),
    rank: z.number().optional(),
    rating: z.number().optional().nullable(),
    review_count: z.number().optional().nullable(),
    category: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await requireBusinessAccess(parsed.data.businessId);
    const supabase = createServiceClient();
    const raw = parsed.data.rawResult as StoredCompetitor;
    const entityKey = entityKeyFromRawResult(raw);
    const domain = normalizeDomain(raw.url);

    let competitor = null;
    if (raw.cid) {
      const { data } = await supabase.from("competitors").select("*").eq("cid", raw.cid).maybeSingle();
      competitor = data;
    }
    if (!competitor && raw.place_id) {
      const { data } = await supabase.from("competitors").select("*").eq("place_id", raw.place_id).maybeSingle();
      competitor = data;
    }
    if (!competitor && raw.name) {
      const { data } = await supabase
        .from("competitors")
        .select("*")
        .ilike("name", raw.name.trim())
        .limit(1)
        .maybeSingle();
      competitor = data;
    }

    if (!competitor && domain) {
      const { data } = await supabase
        .from("competitors")
        .select("*")
        .ilike("website_url", `%${domain}%`)
        .limit(1)
        .maybeSingle();
      competitor = data;
    }

    return NextResponse.json({
      competitorId: competitor?.id ?? null,
      entityKey: competitor ? entityKeyFromRawResult(competitor) : entityKey,
      isTracked: !!competitor,
      limitedData: !competitor,
      profile: competitor ?? rawResultToProfile(raw),
      name: competitor?.name ?? raw.name ?? "Unknown business",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resolve failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
