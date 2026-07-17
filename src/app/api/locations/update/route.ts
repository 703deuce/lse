import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  locationId: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  defaultGridSize: z.number().int().min(3).max(11).optional(),
  defaultRadiusMiles: z.number().min(0.5).max(10).optional(),
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name) updates.name = parsed.data.name.trim();
    if (parsed.data.address !== undefined) updates.address = parsed.data.address?.trim() || null;
    if (parsed.data.city !== undefined) updates.city = parsed.data.city?.trim() || null;
    if (parsed.data.state !== undefined) updates.state = parsed.data.state?.trim() || null;
    if (parsed.data.lat != null) updates.lat = parsed.data.lat;
    if (parsed.data.lng != null) updates.lng = parsed.data.lng;
    if (parsed.data.defaultGridSize != null) updates.default_grid_size = parsed.data.defaultGridSize;
    if (parsed.data.defaultRadiusMiles != null) updates.default_radius_miles = parsed.data.defaultRadiusMiles;

    const { data: row, error } = await supabase
      .from("rank_locations")
      .update(updates)
      .eq("id", parsed.data.locationId)
      .eq("business_id", parsed.data.businessId)
      .select("*")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ location: row });
  } catch (err) {
    return httpErrorFromException(err, "Update location failed");
  }
}
