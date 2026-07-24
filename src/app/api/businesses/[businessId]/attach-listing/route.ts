import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  place_id: z.string().min(1).nullable().optional(),
  cid: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  website_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address_text: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  primary_category: z.string().nullable().optional(),
  scan_center_lat: z.number().nullable().optional(),
  scan_center_lng: z.number().nullable().optional(),
  scan_center_label: z.string().max(240).nullable().optional(),
  service_area_mode: z.enum(["storefront", "service_area"]).optional(),
});

/**
 * Attach / refresh a Google listing on an existing business.
 * Used by first-time reputation setup — requires business access only
 * (not the review_campaigns entitlement).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const p = parsed.data;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (p.place_id !== undefined) updates.place_id = p.place_id;
    if (p.cid !== undefined) updates.cid = p.cid;
    if (p.name !== undefined) updates.name = p.name;
    if (p.website_url !== undefined) updates.website_url = p.website_url;
    if (p.phone !== undefined) updates.phone = p.phone;
    if (p.address_text !== undefined) updates.address_text = p.address_text;
    if (p.lat !== undefined) updates.lat = p.lat;
    if (p.lng !== undefined) updates.lng = p.lng;
    if (p.primary_category !== undefined) updates.primary_category = p.primary_category;
    if (p.scan_center_lat !== undefined) updates.scan_center_lat = p.scan_center_lat;
    if (p.scan_center_lng !== undefined) updates.scan_center_lng = p.scan_center_lng;
    if (p.scan_center_label !== undefined) updates.scan_center_label = p.scan_center_label;
    if (p.service_area_mode !== undefined) updates.service_area_mode = p.service_area_mode;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .select("id, name, place_id, phone, website_url, primary_category")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    return NextResponse.json({ business: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to attach listing");
  }
}
