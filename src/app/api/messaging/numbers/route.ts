import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getBusiness } from "@/lib/db/queries";
import { messagingOnboarding } from "@/lib/messaging/service";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    const business = await getBusiness(businessId, auth.organizationId);
    const numbers = await messagingOnboarding.searchNumbers({
      organizationId: auth.organizationId,
      businessId,
      businessName: business?.name?.trim() || "Business",
      areaCode: url.searchParams.get("areaCode") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      postalCode: url.searchParams.get("postalCode") ?? undefined,
      contains: url.searchParams.get("contains") ?? undefined,
    });
    return NextResponse.json({ numbers });
  } catch (err) {
    return httpErrorFromException(err, "Failed to search numbers");
  }
}
