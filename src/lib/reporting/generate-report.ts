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
  /** When false, build HTML/payload without upserting a shareable report row. */
  persist?: boolean;
  /** Prefer updating this generating share row (async share flow). */
  reportId?: string | null;
  /** Preserve an already-issued share token when filling a generating row. */
  shareToken?: string | null;
  /**
   * Stable share identity from create-time. When set (async share flow), must win
   * over recomputed keys so worker updates don't rewrite competitor:…:default → top-5.
   */
  identityKey?: string | null;
};

export type GenerateReportResult = {
  reportId: string | null;
  shareToken: string | null;
  html: string;
  payload: AnyReportPayload;
};

type ReportMeta = {
  reportType?: string;
  identityKey?: string;
};

/** Drop bulky fields from metadata_json while keeping KPI/identity useful. */
function slimReportPayloadForMetadata(payload: AnyReportPayload): AnyReportPayload {
  if (payload.reportType === "single_scan") {
    return {
      ...payload,
      heatmap: {
        gridSize: payload.heatmap.gridSize,
        cells: [],
      },
      competitors: payload.competitors.slice(0, 25).map((c) => ({
        ...c,
        address: c.address ? c.address.slice(0, 120) : c.address,
      })),
    };
  }
  if (payload.reportType === "competitor") {
    return {
      ...payload,
      competitors: payload.competitors.slice(0, 40),
    };
  }
  return payload;
}

function reportIdentityKey(
  payload: AnyReportPayload,
  params: GenerateReportParams
): string {
  switch (payload.reportType) {
    case "single_scan":
      return `single_scan:${payload.parameters.scanId}`;
    case "competitor":
      // Use post-default selection from the payload (builder fills top 5 when empty).
      return `competitor:${payload.parameters.scanId}:${[...payload.selectedCompetitorKeys]
        .sort()
        .join(",")}`;
    case "trend":
      return [
        "trend",
        params.keywordId ?? payload.parameters.keyword,
        payload.parameters.locationId ?? "biz",
        payload.parameters.gridSize,
        payload.parameters.radiusMeters,
      ].join(":");
    case "location":
      return "location";
    case "keyword":
      return [
        "keyword",
        payload.parameters.keywordId ?? payload.parameters.keyword,
        payload.parameters.gridSize,
        payload.parameters.radiusMeters,
      ].join(":");
    case "maps_campaign":
      return "maps_campaign";
    case "reviews":
      return "reviews";
    case "review_campaign":
      return `review_campaign:${payload.parameters.campaignId}`;
    default: {
      const _exhaustive: never = payload;
      return String((_exhaustive as AnyReportPayload).reportType);
    }
  }
}

/** Persist scan_batch_id only when the report is fundamentally about that scan. */
function persistScanBatchId(payload: AnyReportPayload): string | null {
  if (payload.reportType === "single_scan" || payload.reportType === "competitor") {
    return payload.parameters.scanId;
  }
  return null;
}

async function resolveExistingShare(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    businessId: string;
    reportType: string;
    identityKey: string;
  }
): Promise<{ existingReportId: string | null; shareToken: string; shareExpiresAt: string }> {
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Exact reportType + identityKey match — never collapse across campaigns/types.
  const { data: existingReports } = await supabase
    .from("reports")
    .select("id, share_token, share_expires_at, metadata_json")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .order("generated_at", { ascending: false })
    .limit(1);

  const matched = (existingReports ?? [])[0] ?? null;

  const existingExpiresAt = matched?.share_expires_at
    ? new Date(matched.share_expires_at as string).getTime()
    : null;
  const existingExpired =
    existingExpiresAt !== null &&
    Number.isFinite(existingExpiresAt) &&
    existingExpiresAt <= Date.now();
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
  html: string;
  payload: AnyReportPayload;
  identityKey: string;
  reportId?: string | null;
  preferShareToken?: string | null;
}): Promise<GenerateReportResult> {
  const supabase = createServiceClient();
  const scanBatchId = persistScanBatchId(params.payload);
  const resolved = await resolveExistingShare(supabase, {
    businessId: params.businessId,
    reportType: params.payload.reportType,
    identityKey: params.identityKey,
  });
  const existingReportId = params.reportId ?? resolved.existingReportId;
  const shareToken = params.preferShareToken || resolved.shareToken;
  const shareExpiresAt = resolved.shareExpiresAt;

  // Keep metadata lean — full heatmap cells + HTML already live in html_content.
  // Oversized metadata_json has caused share/export instability on large grids.
  const slimPayload = slimReportPayloadForMetadata(params.payload);
  const metadata = {
    reportType: params.payload.reportType,
    identityKey: params.identityKey,
    payload: slimPayload,
    generatedAt: params.payload.generatedAt,
    artifactKind: "html_share",
  } satisfies ReportMeta & {
    payload: AnyReportPayload;
    generatedAt: string;
    artifactKind: string;
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
        scan_batch_id: scanBatchId,
        artifact_kind: "html_share",
        artifact_status: "ready",
        error_message: null,
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
      scan_batch_id: scanBatchId,
      share_token: shareToken,
      share_expires_at: shareExpiresAt,
      html_content: params.html,
      metadata_json: metadata,
      artifact_kind: "html_share",
      artifact_status: "ready",
    })
    .select("id")
    .single();

  // Concurrent create of the same identity — fall back to update the winner row.
  if (error && /duplicate|unique/i.test(error.message)) {
    const retry = await resolveExistingShare(supabase, {
      businessId: params.businessId,
      reportType: params.payload.reportType,
      identityKey: params.identityKey,
    });
    if (!retry.existingReportId) {
      throw new Error(error.message);
    }
    const { data: updated, error: updateErr } = await supabase
      .from("reports")
      .update({
        share_token: retry.shareToken,
        share_expires_at: retry.shareExpiresAt,
        html_content: params.html,
        metadata_json: metadata,
        generated_at: new Date().toISOString(),
        scan_batch_id: scanBatchId,
        artifact_kind: "html_share",
        artifact_status: "ready",
        error_message: null,
      })
      .eq("id", retry.existingReportId)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (updateErr || !updated) throw new Error(updateErr?.message ?? "Failed to update report");
    return {
      reportId: updated.id,
      shareToken: retry.shareToken,
      html: params.html,
      payload: params.payload,
    };
  }

  if (error || !report) throw new Error(error?.message ?? "Failed to create report");
  return {
    reportId: report.id,
    shareToken,
    html: params.html,
    payload: params.payload,
  };
}

export async function buildTypedReportPayload(
  params: GenerateReportParams
): Promise<AnyReportPayload> {
  const reportType = params.reportType ?? "single_scan";

  if (reportType === "single_scan") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for single_scan reports");
    return buildSingleScanReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "trend") {
    return buildTrendReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      locationId: params.locationId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "competitor") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for competitor reports");
    return buildCompetitorReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      selectedCompetitorKeys: params.selectedCompetitorKeys,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "location") {
    return buildLocationReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "keyword") {
    return buildKeywordReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "maps_campaign") {
    return buildMapsCampaignReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "reviews") {
    return buildReviewsReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "review_campaign") {
    if (!params.campaignId) {
      throw new Error("campaignId is required for review_campaign reports");
    }
    return buildReviewCampaignReport({
      businessId: params.businessId,
      campaignId: params.campaignId,
      whiteLabel: params.whiteLabel,
    });
  }

  throw new Error(`Report type "${reportType}" is not implemented yet`);
}

export async function generateTypedReport(
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  const payload = await buildTypedReportPayload(params);
  const html = renderReportHtml(payload);
  // Prefer create-time identity (async share) so worker updates keep the same key.
  const identityKey = params.identityKey?.trim() || reportIdentityKey(payload, params);

  if (params.persist === false) {
    return {
      reportId: null,
      shareToken: null,
      html,
      payload,
    };
  }

  return persistReport({
    businessId: params.businessId,
    html,
    payload,
    identityKey,
    reportId: params.reportId,
    preferShareToken: params.shareToken,
  });
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
  if (!result.reportId || !result.shareToken) {
    throw new Error("Failed to persist report");
  }
  return {
    reportId: result.reportId,
    shareToken: result.shareToken,
    html: result.html,
  };
}
