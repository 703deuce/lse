import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/context";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { httpErrorFromException } from "@/lib/security/http-errors";

const schema = z.object({
  name: z.enum([
    "report_share_link_copied",
    "report_pdf_downloaded",
    "scan_comparison_viewed",
    "ai_visibility_added_to_report",
  ]),
  businessId: z.string().uuid().optional(),
  reportId: z.string().uuid().optional(),
  scanId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    trackProductEvent(parsed.data.name, {
      organizationId: auth.organizationId,
      businessId: parsed.data.businessId,
      reportId: parsed.data.reportId,
      scanId: parsed.data.scanId,
      campaignId: parsed.data.campaignId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Event failed");
  }
}
