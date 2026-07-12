import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { logManualReviewSend } from "@/lib/reputation/review-sends";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      customerName?: string;
      channel?: string;
      notes?: string;
      customerEmail?: string;
      customerPhone?: string;
      serviceType?: string;
    };

    if (!body.businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(body.businessId);
    const send = await logManualReviewSend({
      businessId: body.businessId,
      organizationId: auth.organizationId,
      customerName: body.customerName,
      channel: body.channel,
      notes: body.notes,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      serviceType: body.serviceType,
    });

    return NextResponse.json({ ok: true, send });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Manual log failed";
    const status = message.includes("Review link missing") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
