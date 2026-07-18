import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import {
  generateExecutiveSummary,
  SUMMARY_TONES,
  type SummaryTone,
} from "@/lib/reporting/ai-executive-summary";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import { trackProductEvent } from "@/lib/analytics/product-events";
import type { ReportType } from "@/lib/reporting/types";

const schema = z.object({
  businessId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  tone: z
    .enum(["professional", "simple", "positive_honest", "detailed"])
    .default("professional"),
  summary: z.string().max(4000).optional(),
  save: z.boolean().optional(),
  keyword: z.string().optional(),
  reportLabel: z.string().optional(),
  kpis: z
    .object({
      arp: z.number().nullable().optional(),
      atrp: z.number().nullable().optional(),
      top3Pct: z.number().nullable().optional(),
      top10Pct: z.number().nullable().optional(),
      notFoundPct: z.number().nullable().optional(),
      visibilityScore: z.number().nullable().optional(),
    })
    .optional(),
  priorKpis: z
    .object({
      arp: z.number().nullable().optional(),
      top3Pct: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  aiMentioned: z.number().nullable().optional(),
  aiTotal: z.number().nullable().optional(),
});

export async function GET() {
  return NextResponse.json({ tones: SUMMARY_TONES });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const p = parsed.data;
    const auth = await requireBusinessAccess(p.businessId);
    await requireOrganizationPermission("report.create", auth.organizationId);

    const rate = await assertRateLimit({
      key: `report-summary:${auth.organizationId}`,
      maxPerWindow: 30,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many summary requests. Try again shortly." },
        { status: 429 }
      );
    }

    const supabase = createServiceClient();

    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", p.businessId)
      .maybeSingle();

    let summary = p.summary?.trim() ?? "";
    let source: "ai" | "deterministic" | "user" = "user";

    if (!summary) {
      const generated = await generateExecutiveSummary({
        organizationId: auth.organizationId,
        tone: p.tone as SummaryTone,
        input: {
          businessName: (business?.name as string) || "Business",
          keyword: p.keyword,
          reportLabel: p.reportLabel ?? "Client report",
          kpis: p.kpis ?? {},
          priorKpis: p.priorKpis ?? null,
          aiMentioned: p.aiMentioned,
          aiTotal: p.aiTotal,
        },
      });
      summary = generated.summary;
      source = generated.source;
    }

    if (p.save && p.reportId) {
      const { data: report } = await supabase
        .from("reports")
        .select("id, metadata_json, scan_batch_id, share_token")
        .eq("id", p.reportId)
        .eq("business_id", p.businessId)
        .maybeSingle();
      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const prevMeta = (report.metadata_json as Record<string, unknown>) ?? {};
      const meta = {
        ...prevMeta,
        executiveSummary: summary,
        summaryTone: p.tone,
        summaryApproved: true,
      };
      await supabase
        .from("reports")
        .update({ metadata_json: meta })
        .eq("id", p.reportId)
        .eq("business_id", p.businessId);

      // Rebuild HTML so share links show the new summary (bypass stale reuse).
      const reportType = (prevMeta.reportType as ReportType | undefined) ?? "single_scan";
      const campaignId =
        (prevMeta.campaignId as string | null | undefined) ??
        ((prevMeta.payload as { parameters?: { campaignId?: string } } | undefined)
          ?.parameters?.campaignId ?? null);
      try {
        await generateTypedReport({
          businessId: p.businessId,
          scanBatchId: (report.scan_batch_id as string | null) ?? undefined,
          reportType,
          campaignId,
          reportId: p.reportId,
          shareToken: (report.share_token as string | null) ?? undefined,
          identityKey: (prevMeta.identityKey as string | undefined) ?? undefined,
          executiveSummary: summary,
          sections:
            (prevMeta.sections as Partial<Record<string, boolean>> | undefined) ??
            null,
          persist: true,
        });
      } catch {
        // Metadata is saved even if rebuild fails (e.g. missing scan for old row).
      }

      trackProductEvent("report_draft_created", {
        organizationId: auth.organizationId,
        businessId: p.businessId,
        reportId: p.reportId,
      });
    }

    return NextResponse.json({ summary, source, tone: p.tone });
  } catch (err) {
    return httpErrorFromException(err, "Summary generation failed");
  }
}
