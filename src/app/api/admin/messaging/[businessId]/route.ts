import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/db/client";
import { messagingOnboarding } from "@/lib/messaging/service";
import { httpErrorFromException } from "@/lib/security/http-errors";

async function resolveBusiness(businessId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name, organization_id")
    .eq("id", businessId)
    .maybeSingle();
  return {
    organizationId: String(data?.organization_id ?? "unknown"),
    businessId,
    businessName: String(data?.name ?? "Business"),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { businessId } = await context.params;
    const ctx = await resolveBusiness(businessId);
    const result = await messagingOnboarding.getCustomerAccount(ctx);
    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load messaging customer");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { businessId } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "override");
    const ctx = await resolveBusiness(businessId);

    if (action === "refresh") {
      const registration = await messagingOnboarding.refreshStatus(ctx);
      return NextResponse.json({ registration });
    }

    if (action === "resubmit") {
      const registration = await messagingOnboarding.submitBusinessProfile(ctx);
      return NextResponse.json({ registration });
    }

    const registration = await messagingOnboarding.adminUpdate({
      ...ctx,
      patch: body.patch ?? {},
    });
    return NextResponse.json({ registration });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update messaging customer");
  }
}
