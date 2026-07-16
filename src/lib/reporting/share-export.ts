import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/db/client";
import type { ReportType } from "@/lib/reporting/types";

/** Stable identity for share reuse / idempotent enqueue (no time bucket). */
export function shareIdentityKey(params: {
  reportType: ReportType;
  scanBatchId?: string | null;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
}): string {
  switch (params.reportType) {
    case "single_scan":
      return `single_scan:${params.scanBatchId ?? "na"}`;
    case "competitor": {
      const keys = [...(params.selectedCompetitorKeys ?? [])].sort().join(",") || "default";
      return `competitor:${params.scanBatchId ?? "na"}:${keys}`;
    }
    case "trend":
      return [
        "trend",
        params.keywordId ?? "kw",
        params.locationId ?? "biz",
        params.gridSize ?? "g",
        params.radiusMeters ?? "r",
      ].join(":");
    case "location":
      return "location";
    case "keyword":
      return [
        "keyword",
        params.keywordId ?? "kw",
        params.gridSize ?? "g",
        params.radiusMeters ?? "r",
      ].join(":");
    case "maps_campaign":
      return "maps_campaign";
    case "reviews":
      return "reviews";
    case "review_campaign":
      return `review_campaign:${params.campaignId ?? "na"}`;
    default:
      return String(params.reportType);
  }
}

export async function findReusableShare(params: {
  businessId: string;
  reportType: string;
  identityKey: string;
}): Promise<{
  reportId: string;
  shareToken: string;
  shareUrl: string;
  status: "ready" | "generating";
} | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("reports")
    .select("id, share_token, share_expires_at, html_content, artifact_status")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .not("share_token", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.share_token) return null;
  const expiresAt = data.share_expires_at ? new Date(data.share_expires_at as string).getTime() : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const artifactStatus = String(data.artifact_status ?? "");
  if (data.html_content) {
    return {
      reportId: data.id as string,
      shareToken: data.share_token as string,
      shareUrl: `/reports/share/${data.share_token}`,
      status: "ready",
    };
  }
  if (artifactStatus === "generating") {
    return {
      reportId: data.id as string,
      shareToken: data.share_token as string,
      shareUrl: `/reports/share/${data.share_token}`,
      status: "generating",
    };
  }
  return null;
}

/** Create a durable generating share row so the API can return immediately. */
export async function createGeneratingShareRecord(params: {
  businessId: string;
  reportType: ReportType;
  identityKey: string;
  scanBatchId?: string | null;
  campaignId?: string | null;
}): Promise<{ reportId: string; shareToken: string; shareUrl: string }> {
  const supabase = createServiceClient();
  const shareToken = randomBytes(16).toString("hex");
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Reuse an in-flight generating row for the same identity (idempotent double-click).
  const { data: inflight } = await supabase
    .from("reports")
    .select("id, share_token")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>identityKey", params.identityKey)
    .eq("artifact_status", "generating")
    .not("share_token", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inflight?.id && inflight.share_token) {
    return {
      reportId: inflight.id as string,
      shareToken: inflight.share_token as string,
      shareUrl: `/reports/share/${inflight.share_token}`,
    };
  }

  const scanBatchId =
    params.reportType === "single_scan" || params.reportType === "competitor"
      ? params.scanBatchId ?? null
      : null;

  const { data, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: scanBatchId,
      share_token: shareToken,
      share_expires_at: shareExpiresAt,
      html_content: null,
      artifact_kind: "html_share",
      artifact_status: "generating",
      metadata_json: {
        reportType: params.reportType,
        identityKey: params.identityKey,
        artifactKind: "html_share",
        campaignId: params.campaignId ?? null,
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    // Unique race — only reuse an in-flight generating row (never failed/stale).
    const { data: raced } = await supabase
      .from("reports")
      .select("id, share_token, artifact_status, share_expires_at")
      .eq("business_id", params.businessId)
      .eq("metadata_json->>identityKey", params.identityKey)
      .eq("artifact_status", "generating")
      .not("share_token", "is", null)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (raced?.id && raced.share_token) {
      const expiresAt = raced.share_expires_at
        ? new Date(raced.share_expires_at as string).getTime()
        : 0;
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        return {
          reportId: raced.id as string,
          shareToken: raced.share_token as string,
          shareUrl: `/reports/share/${raced.share_token}`,
        };
      }
    }
    throw new Error(error?.message ?? "Failed to create share record");
  }

  return {
    reportId: data.id as string,
    shareToken,
    shareUrl: `/reports/share/${shareToken}`,
  };
}
