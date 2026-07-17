import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { addTrackedKeyword } from "@/lib/keyword-tracker/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keyword, locationName, lat, lng, trackingFrequency, fetchVolume, suggestionId } = body as {
      businessId?: string;
      keyword?: string;
      locationName?: string;
      lat?: number;
      lng?: number;
      trackingFrequency?: "daily" | "weekly";
      fetchVolume?: boolean;
      suggestionId?: string;
    };

    if (!businessId || !keyword?.trim()) {
      return NextResponse.json({ error: "businessId and keyword required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const row = await addTrackedKeyword({
      businessId,
      organizationId: auth.organizationId,
      keyword,
      locationName,
      lat,
      lng,
      trackingFrequency,
      fetchVolume,
      suggestionId,
    });

    return NextResponse.json({ keyword: row });
  } catch (err) {
    return httpErrorFromException(err, "Failed to add keyword");
  }
}
