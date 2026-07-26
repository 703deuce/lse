import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getBusiness } from "@/lib/db/queries";
import { messagingOnboarding } from "@/lib/messaging/service";
import { buildProgressSteps, nextSetupHref } from "@/lib/messaging/status";
import { httpErrorFromException } from "@/lib/security/http-errors";

async function resolveBusiness(businessId: string) {
  const auth = await requireBusinessAccess(businessId);
  const business = await getBusiness(businessId, auth.organizationId);
  return {
    organizationId: auth.organizationId,
    businessId,
    businessName: business?.name?.trim() || "Business",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const ctx = await resolveBusiness(businessId);
    const { registration, events } = await messagingOnboarding.getCustomerAccount(ctx);
    return NextResponse.json({
      registration,
      events,
      progress: buildProgressSteps(registration, businessId),
      nextHref: nextSetupHref(registration, businessId),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load messaging registration");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const action = String(body.action ?? "");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const ctx = await resolveBusiness(businessId);

    let registration;
    switch (action) {
      case "start":
        registration = await messagingOnboarding.startRegistration(ctx);
        break;
      case "save_business":
        registration = await messagingOnboarding.saveBusinessProfile({
          ...ctx,
          business: body.business,
        });
        break;
      case "save_use_case":
        registration = await messagingOnboarding.saveUseCase({
          ...ctx,
          useCase: body.useCase,
        });
        break;
      case "submit":
        registration = await messagingOnboarding.submitBusinessProfile(ctx);
        break;
      case "refresh_status":
        registration = await messagingOnboarding.refreshStatus(ctx);
        break;
      case "purchase_number":
        registration = await messagingOnboarding.purchaseNumber({
          ...ctx,
          phoneNumber: String(body.phoneNumber ?? ""),
        });
        break;
      case "release_number":
        registration = await messagingOnboarding.releaseNumber(ctx);
        break;
      case "activate":
        registration = await messagingOnboarding.activateMessaging(ctx);
        break;
      case "pause":
        registration = await messagingOnboarding.pauseMessaging(ctx);
        break;
      case "resume":
        registration = await messagingOnboarding.resumeMessaging(ctx);
        break;
      case "send_test": {
        const result = await messagingOnboarding.sendTestSms({
          ...ctx,
          toPhone: String(body.toPhone ?? body.phoneNumber ?? ""),
          body: typeof body.body === "string" ? body.body : undefined,
        });
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        registration = (await messagingOnboarding.getCustomerAccount(ctx)).registration;
        return NextResponse.json({
          registration,
          messageSid: result.messageSid,
          progress: buildProgressSteps(registration, businessId),
          nextHref: nextSetupHref(registration, businessId),
        });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const events = (
      await messagingOnboarding.getCustomerAccount(ctx)
    ).events;

    return NextResponse.json({
      registration,
      events,
      progress: buildProgressSteps(registration, businessId),
      nextHref: nextSetupHref(registration, businessId),
    });
  } catch (err) {
    return httpErrorFromException(err, "Messaging registration action failed");
  }
}
