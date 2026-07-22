import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { buildProspectAuditReport } from "@/lib/prospect-audit/build-report";
import {
  MAX_KEYWORDS,
  startProspectAudit,
} from "@/lib/prospect-audit/run";

const runSchema = z.object({
  businessId: z.string().uuid(),
  keywords: z.array(z.string().min(1).max(120)).min(1).max(MAX_KEYWORDS),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const auditId = searchParams.get("auditId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const report = await buildProspectAuditReport(businessId, { auditId });
    return NextResponse.json({ report });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load prospect audit");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { businessId, keywords } = parsed.data;
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("business.update", auth.organizationId);

    const rate = await assertRateLimit({
      key: `prospect-audit:${auth.organizationId}`,
      maxPerWindow: 10,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }

    const started = await startProspectAudit({
      organizationId: auth.organizationId,
      businessId,
      keywords: keywords.slice(0, MAX_KEYWORDS),
    });

    const report = await buildProspectAuditReport(businessId, {
      auditId: started.auditId.startsWith("ephemeral-") ? null : started.auditId,
    });

    return NextResponse.json({
      auditId: started.auditId,
      keywords: keywords.slice(0, MAX_KEYWORDS),
      scanBatchIds: started.scanBatchIds,
      growthJobId: started.growthJobId,
      aiVisibilityJobId: started.aiVisibilityJobId,
      warnings: started.warnings,
      report: report.status === "idle" ? { ...report, status: "running" } : report,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to start prospect audit");
  }
}
