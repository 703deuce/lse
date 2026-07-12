import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { setBusinessGeom } from "@/lib/db/geo";
import { parseUsAddressCityState } from "@/lib/geo/us-address";
import { createBusinessSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;
    const supabase = createServiceClient();

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        organization_id: auth.organizationId,
        name: data.name,
        website_url: data.website_url ?? null,
        phone: data.phone ?? null,
        address_text: data.address_text ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        place_id: data.place_id ?? null,
        cid: data.cid ?? null,
        primary_category: data.primary_category ?? null,
        service_area_mode: data.service_area_mode ?? "storefront",
        scan_center_lat: data.scan_center_lat ?? data.lat ?? null,
        scan_center_lng: data.scan_center_lng ?? data.lng ?? null,
      })
      .select("*")
      .single();

    if (error || !business) {
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
    }

    if (business.lat && business.lng) {
      await setBusinessGeom(business.id, business.lng, business.lat);
    }

    if (data.keyword) {
      const fromAddress = parseUsAddressCityState(data.address_text);
      await supabase.from("business_keywords").insert({
        business_id: business.id,
        keyword: data.keyword.trim(),
        is_primary: true,
        city: data.city ?? fromAddress.city,
        state: data.state ?? fromAddress.state,
        country: data.country ?? "US",
      });
    }

    return NextResponse.json({ business });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
