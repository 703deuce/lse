import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/db/client";
import { buildCompetitorReport } from "@/lib/reporting/build-competitor";
import { buildKeywordReport } from "@/lib/reporting/build-keyword";
import { buildLocationReport } from "@/lib/reporting/build-location";
import { buildMapsCampaignReport } from "@/lib/reporting/build-maps-campaign";
import { buildReviewCampaignReport } from "@/lib/reporting/build-review-campaign";
import { buildReviewsReport } from "@/lib/reporting/build-reviews";
import { buildSingleScanReport } from "@/lib/reporting/build-single-scan";
import { buildTrendReport } from "@/lib/reporting/build-trend";
import { renderReportHtml } from "@/lib/reporting/render-html";
import type {
  AnyReportPayload,
  ReportType,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

export type GenerateReportParams = {
  businessId: string;
  scanBatchId?: string;
  reportType?: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  whiteLabel?: Partial<WhiteLabelConfig>;
};

export type GenerateReportResult = {
  reportId: string;
  shareToken: string;
  html: string;
  payload: AnyReportPayload;
};

async function resolveShareToken(
  supabase: ReturnType<typeof createServiceClient>,
  params: { businessId: string; scanBatchId?: string | null; reportType: string }
): Promise<{ existingReportId: string | null; shareToken: string; shareExpiresAt: string }> {
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("reports")
    .select("id, share_token, share_expires_at, metadata_json")
    .eq("business_id", params.businessId)
    .order("generated_at", { ascending: false })
    .limit(8);

  if (params.scanBatchId) {
    query = query.eq("scan_batch_id", params.scanBatchId);
  } else {
    query = query.is("scan_batch_id", null);
  }

  const { data: existingReports } = await query;
  const matched =
    (existingReports ?? []).find((r) => {
      const meta = (r.metadata_json ?? {}) as { reportType?: string };
      return meta.reportType === params.reportType || !meta.reportType;
    }) ?? null;

  const existingExpiresAt = matched?.share_expires_at
    ? new Date(matched.share_expires_at as string).getTime()
    : null;
  const existingExpired =
    existingExpiresAt !== null && Number.isFinite(existingExpiresAt) && existingExpiresAt <= Date.now();
  const shareToken =
    matched?.share_token && !existingExpired
      ? (matched.share_token as string)
      : randomBytes(16).toString("hex");

  return {
    existingReportId: (matched?.id as string | undefined) ?? null,
    shareToken,
    shareExpiresAt,
  };
}

async function persistReport(params: {
  businessId: string;
  scanBatchId?: string | null;
  html: string;
  payload: AnyReportPayload;
}): Promise<GenerateReportResult> {
  const supabase = createServiceClient();
  const { existingReportId, shareToken, shareExpiresAt } = await resolveShareToken(supabase, {
    businessId: params.businessId,
    scanBatchId: params.scanBatchId,
    reportType: params.payload.reportType,
  });

  const metadata = {
    reportType: params.payload.reportType,
    payload: params.payload,
    generatedAt: params.payload.generatedAt,
  };

  if (existingReportId) {
    const { data: report, error } = await supabase
      .from("reports")
      .update({
        share_token: shareToken,
        share_expires_at: shareExpiresAt,
        html_content: params.html,
        metadata_json: metadata,
        generated_at: new Date().toISOString(),
        scan_batch_id: params.scanBatchId ?? null,
      })
      .eq("id", existingReportId)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (error || !report) throw new Error(error?.message ?? "Failed to update report");
    return {
      reportId: report.id,
      shareToken,
      html: params.html,
      payload: params.payload,
    };
  }

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: params.scanBatchId ?? null,
      share_token: shareToken,
      share_expires_at: shareExpiresAt,
      html_content: params.html,
      metadata_json: metadata,
    })
    .select("id")
    .single();

  if (error || !report) throw new Error(error?.message ?? "Failed to create report");
  return {
    reportId: report.id,
    shareToken,
    html: params.html,
    payload: params.payload,
  };
}

export async function generateTypedReport(
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  const reportType = params.reportType ?? "single_scan";

  if (reportType === "single_scan") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for single_scan reports");
    const payload = await buildSingleScanReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    return persistReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      html,
      payload,
    });
  }

  if (reportType === "trend") {
    const payload = await buildTrendReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      locationId: params.locationId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    const lastScanId = payload.series[payload.series.length - 1]?.scanId ?? params.scanBatchId ?? null;
    return persistReport({
      businessId: params.businessId,
      scanBatchId: lastScanId,
      html,
      payload,
    });
  }

  if (reportType === "competitor") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for competitor reports");
    const payload = await buildCompetitorReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      selectedCompetitorKeys: params.selectedCompetitorKeys,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    return persistReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      html,
      payload,
    });
  }

  if (reportType === "location") {
    const payload = await buildLocationReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    return persistReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId ?? null,
      html,
      payload,
    });
  }

  if (reportType === "keyword") {
    const payload = await buildKeywordReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    const firstScan = payload.locations.find((l) => l.scanId)?.scanId ?? params.scanBatchId ?? null;
    return persistReport({
      businessId: params.businessId,
      scanBatchId: firstScan,
      html,
      payload,
    });
  }

  if (reportType === "maps_campaign") {
    const payload = await buildMapsCampaignReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    const firstScan = payload.keywords.find((k) => k.scanId)?.scanId ?? params.scanBatchId ?? null;
    return persistReport({
      businessId: params.businessId,
      scanBatchId: firstScan,
      html,
      payload,
    });
  }

  if (reportType === "reviews") {
    const payload = await buildReviewsReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    return persistReport({
      businessId: params.businessId,
      scanBatchId: null,
      html,
      payload,
    });
  }

  if (reportType === "review_campaign") {
    if (!params.campaignId) {
      throw new Error("campaignId is required for review_campaign reports");
    }
    const payload = await buildReviewCampaignReport({
      businessId: params.businessId,
      campaignId: params.campaignId,
      whiteLabel: params.whiteLabel,
    });
    const html = renderReportHtml(payload);
    return persistReport({
      businessId: params.businessId,
      scanBatchId: null,
      html,
      payload,
    });
  }

  throw new Error(`Report type "${reportType}" is not implemented yet`);
}

/** Backward-compatible entry: defaults to single_scan and requires scanBatchId. */
export async function generateReport(params: {
  businessId: string;
  scanBatchId: string;
  reportType?: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<{ reportId: string; shareToken: string; html: string }> {
  const result = await generateTypedReport({
    ...params,
    reportType: params.reportType ?? "single_scan",
  });
  return {
    reportId: result.reportId,
    shareToken: result.shareToken,
    html: result.html,
  };
}
