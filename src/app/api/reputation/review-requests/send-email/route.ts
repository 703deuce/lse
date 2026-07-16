import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireCampaignSendAccess } from "@/lib/auth/entitlements";
import { sendReviewRequestEmail } from "@/lib/reputation/review-sends";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = (await request.json()) as {
      businessId?: string;
      customerName?: string;
      customerEmail?: string;
      serviceType?: string;
      templateId?: string;
      customMessage?: string;
    };

    if (!body.businessId || !body.customerName?.trim() || !body.customerEmail?.trim()) {
      return NextResponse.json(
        { error: "businessId, customerName, and customerEmail are required" },
        { status: 400 }
      );
    }

    const auth = await requireBusinessAccess(body.businessId);
    await requireCampaignSendAccess(auth.organizationId);
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "review_emails_sent", 1);
    reserved = true;
    const result = await sendReviewRequestEmail({
      businessId: body.businessId,
      organizationId: auth.organizationId,
      customerName: body.customerName.trim(),
      customerEmail: body.customerEmail.trim(),
      serviceType: body.serviceType,
      templateId: body.templateId,
      customMessage: body.customMessage,
    });

    if (!result.ok) {
      await releaseUsage(auth.organizationId, "review_emails_sent", 1).catch(() => {});
      reserved = false;
      return NextResponse.json({ error: result.error, sendId: result.sendId }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sendId: result.sendId, messageId: result.messageId });
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "review_emails_sent", 1).catch(() => {});
    }
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Email send failed";
    const status =
      message.includes("Review link missing") ||
      message.includes("email") ||
      message.includes("opted out") ||
      message.includes("access denied") ||
      message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
