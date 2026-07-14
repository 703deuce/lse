import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { sendReviewRequestSms } from "@/lib/reputation/review-sends";
import { PlanLimitError, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      customerName?: string;
      customerPhone?: string;
      serviceType?: string;
      templateId?: string;
      customMessage?: string;
    };

    if (!body.businessId || !body.customerName?.trim() || !body.customerPhone?.trim()) {
      return NextResponse.json(
        { error: "businessId, customerName, and customerPhone are required" },
        { status: 400 }
      );
    }

    const auth = await requireBusinessAccess(body.businessId);
    await reserveUsageOrThrow(auth.organizationId, "review_sms_sent", 1);
    const result = await sendReviewRequestSms({
      businessId: body.businessId,
      organizationId: auth.organizationId,
      customerName: body.customerName.trim(),
      customerPhone: body.customerPhone.trim(),
      serviceType: body.serviceType,
      templateId: body.templateId,
      customMessage: body.customMessage,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, sendId: result.sendId }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sendId: result.sendId,
      messageSid: result.messageSid,
      usedTrialTemplate: result.usedTrialTemplate ?? false,
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "SMS send failed";
    const status =
      message.includes("Review link missing") ||
      message.includes("phone") ||
      message.includes("opted out")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
