import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  defaultGridSize: z.number().int().min(3).max(11).default(7),
  defaultRadiusMiles: z.number().min(0.5).max(10).default(5),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const auth = await requireBusinessAccess(parsed.data.businessId);
    const supabase = createServiceClient();

    const { data: row, error } = await supabase
      .from("rank_locations")
      .insert({
        organization_id: auth.organizationId,
        business_id: parsed.data.businessId,
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        city: parsed.data.city?.trim() || null,
        state: parsed.data.state?.trim() || null,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        default_grid_size: parsed.data.defaultGridSize,
        default_radius_miles: parsed.data.defaultRadiusMiles,
      })
      .select("*")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
    }

    return NextResponse.json({ location: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create location failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
