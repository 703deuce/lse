import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  locationId: z.string().uuid(),
  businessId: z.string().uuid(),
});

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let locationId = url.searchParams.get("locationId");
    let businessId = url.searchParams.get("businessId");

    if (!locationId || !businessId) {
      const body = await request.json().catch(() => ({}));
      const parsed = schema.safeParse(body);
      if (parsed.success) {
        locationId = parsed.data.locationId;
        businessId = parsed.data.businessId;
      }
    }

    if (!locationId || !businessId) {
      return NextResponse.json({ error: "locationId and businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("rank_locations")
      .delete()
      .eq("id", locationId)
      .eq("business_id", businessId)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.length) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Delete location failed");
  }
}
