import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { sendReviewRequestEmail } from "@/lib/reputation/review-sends";
import { PlanLimitError, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
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
    await reserveUsageOrThrow(auth.organizationId, "review_emails_sent", 1);
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
      return NextResponse.json({ error: result.error, sendId: result.sendId }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sendId: result.sendId, messageId: result.messageId });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Email send failed";
    const status =
      message.includes("Review link missing") ||
      message.includes("email") ||
      message.includes("opted out")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
