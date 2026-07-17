import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import {
  competitorsToCsv,
  keywordToCsv,
  locationToCsv,
  mapsCampaignToCsv,
  reviewCampaignToCsv,
  reviewsToCsv,
  singleScanToCsv,
  trendToCsv,
} from "@/lib/reporting/csv";
import { singleScanPointsCsv, singleScanSummaryCsv } from "@/lib/reporting/scan-csv";
import {
  createGeneratingShareRecord,
  findReusableShare,
  shareIdentityKey,
} from "@/lib/reporting/share-export";
import { exportReportSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/observability/logger";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";
import type { ReportType } from "@/lib/reporting/types";
import { randomUUID } from "crypto";

function exportStatus(message: string): number {
  if (message.includes("access denied") || message.includes("Authentication required")) {
    return 403;
  }
  if (
    message.includes("required") ||
    message.includes("at least 2") ||
    message.includes("at least two") ||
    message.includes("No review momentum") ||
    message.includes("No completed review momentum") ||
    message.includes("No completed scans") ||
    message.includes("Add a keyword") ||
    message.includes("not implemented") ||
    message.includes("does not belong") ||
    /not found/i.test(message)
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const started = Date.now();
  let stage = "parse";
  let organizationId: string | undefined;
  let businessId: string | undefined;
  let reportType: ReportType | undefined;

  try {
    const body = await request.json();
    const parsed = exportReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message, requestId }, { status: 400 });
    }

    const data = parsed.data;
    businessId = data.businessId;
    stage = "auth";
    const auth = await requireBusinessAccess(data.businessId);
    organizationId = auth.organizationId;

    reportType = (data.reportType ?? "single_scan") as ReportType;
    if (
      (reportType === "single_scan" || reportType === "competitor") &&
      !data.scanBatchId
    ) {
      return NextResponse.json(
        { error: "scanBatchId is required for this report type", requestId },
        { status: 400 }
      );
    }
    if (reportType === "review_campaign" && !data.campaignId) {
      return NextResponse.json(
        { error: "campaignId is required for review campaign reports", requestId },
        { status: 400 }
      );
    }

    const format = data.format ?? "share";

    // CSV variants stay synchronous (small payloads).
    if (format === "csv" || format === "summary_csv" || format === "points_csv") {
      stage = "csv_generate";
      const result = await generateTypedReport({
        businessId: data.businessId,
        scanBatchId: data.scanBatchId,
        reportType,
        keywordId: data.keywordId,
        locationId: data.locationId,
        campaignId: data.campaignId,
        gridSize: data.gridSize,
        radiusMeters: data.radiusMeters,
        selectedCompetitorKeys: data.selectedCompetitorKeys,
        persist: false,
      });
      let csv = "";
      const payload = result.payload;
      if (format === "summary_csv") {
        if (payload.reportType !== "single_scan") {
          return NextResponse.json(
            { error: "Summary CSV is only available for single scan reports", requestId },
            { status: 400 }
          );
        }
        csv = singleScanSummaryCsv(payload);
      } else if (format === "points_csv") {
        if (payload.reportType !== "single_scan") {
          return NextResponse.json(
            { error: "Data points CSV is only available for single scan reports", requestId },
            { status: 400 }
          );
        }
        csv = singleScanPointsCsv(payload);
      } else if (payload.reportType === "single_scan") csv = singleScanToCsv(payload);
      else if (payload.reportType === "trend") csv = trendToCsv(payload);
      else if (payload.reportType === "competitor") csv = competitorsToCsv(payload);
      else if (payload.reportType === "location") csv = locationToCsv(payload);
      else if (payload.reportType === "keyword") csv = keywordToCsv(payload);
      else if (payload.reportType === "maps_campaign") csv = mapsCampaignToCsv(payload);
      else if (payload.reportType === "reviews") csv = reviewsToCsv(payload);
      else if (payload.reportType === "review_campaign") csv = reviewCampaignToCsv(payload);
      else {
        return NextResponse.json(
          { error: "CSV not available for this report type", requestId },
          { status: 400 }
        );
      }
      const filename =
        format === "summary_csv"
          ? "scan-summary.csv"
          : format === "points_csv"
            ? "scan-data-points.csv"
            : `${reportType}-report.csv`;
      logger.info("report_export_csv_ok", {
        requestId,
        organizationId,
        businessId,
        reportType,
        durationMs: Date.now() - started,
      });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Request-Id": requestId,
        },
      });
    }

    // ── HTML shareable report: reuse → enqueue → sync fallback ──
    await requireRecentAuth();
    const permAuth = await requireOrganizationPermission("report.share", auth.organizationId);
    const auditMeta = requestAuditMeta(request);

    stage = "share_identity";
    const identityKey = shareIdentityKey({
      reportType,
      scanBatchId: data.scanBatchId,
      keywordId: data.keywordId,
      locationId: data.locationId,
      campaignId: data.campaignId,
      gridSize: data.gridSize,
      radiusMeters: data.radiusMeters,
      selectedCompetitorKeys: data.selectedCompetitorKeys,
    });

    stage = "share_reuse";
    const reusable = await findReusableShare({
      businessId: data.businessId,
      reportType,
      identityKey,
    });
    if (reusable?.status === "ready") {
      logger.info("report_export_share_reused", {
        requestId,
        organizationId,
        businessId,
        reportType,
        reportId: reusable.reportId,
        status: reusable.status,
        durationMs: Date.now() - started,
      });
      return NextResponse.json({
        queued: false,
        reused: true,
        status: "ready",
        reportId: reusable.reportId,
        shareUrl: reusable.shareUrl,
        reportType,
        requestId,
      });
    }

    // In-flight share: re-dispatch with the same idempotency key so the UI gets a jobId
    // without creating a duplicate report row.
    if (reusable?.status === "generating") {
      stage = "share_reenqueue_inflight";
      const { dispatchFeatureJob } = await import("@/lib/queue/dispatch");
      const job = await dispatchFeatureJob({
        jobType: "generate_report",
        payload: {
          businessId: data.businessId,
          organizationId: auth.organizationId,
          scanBatchId: data.scanBatchId,
          reportType,
          keywordId: data.keywordId,
          locationId: data.locationId,
          campaignId: data.campaignId,
          gridSize: data.gridSize,
          radiusMeters: data.radiusMeters,
          selectedCompetitorKeys: data.selectedCompetitorKeys,
          persist: true,
          reportId: reusable.reportId,
          shareToken: reusable.shareToken,
          identityKey,
        },
        organizationId: auth.organizationId,
        businessId: data.businessId,
        relatedResourceId: reusable.reportId,
        idempotencyKey: `share-html:${data.businessId}:${identityKey}`,
        priority: "normal",
        maxAttempts: 3,
      });
      logger.info("report_export_share_inflight_reused", {
        requestId,
        organizationId,
        businessId,
        reportType,
        reportId: reusable.reportId,
        jobId: job.jobId,
        durationMs: Date.now() - started,
      });
      return NextResponse.json({
        queued: true,
        reused: true,
        status: "generating",
        jobId: job.jobId,
        reportId: reusable.reportId,
        shareUrl: reusable.shareUrl,
        reportType,
        requestId,
      });
    }

    stage = "share_create_record";
    const pending = await createGeneratingShareRecord({
      businessId: data.businessId,
      reportType,
      identityKey,
      scanBatchId: data.scanBatchId,
      campaignId: data.campaignId,
    });

    await writeSecurityAuditEvent({
      action: "report.share.create",
      organizationId: auth.organizationId,
      actorUserId: permAuth.userId,
      actorEmail: permAuth.email,
      resourceType: "report",
      resourceId: pending.reportId,
      ...auditMeta,
    });

    stage = "share_enqueue";
    const { dispatchFeatureJob } = await import("@/lib/queue/dispatch");
    const job = await dispatchFeatureJob({
      jobType: "generate_report",
      payload: {
        businessId: data.businessId,
        organizationId: auth.organizationId,
        scanBatchId: data.scanBatchId,
        reportType,
        keywordId: data.keywordId,
        locationId: data.locationId,
        campaignId: data.campaignId,
        gridSize: data.gridSize,
        radiusMeters: data.radiusMeters,
        selectedCompetitorKeys: data.selectedCompetitorKeys,
        persist: true,
        reportId: pending.reportId,
        shareToken: pending.shareToken,
        identityKey,
      },
      organizationId: auth.organizationId,
      businessId: data.businessId,
      relatedResourceId: pending.reportId,
      idempotencyKey: `share-html:${data.businessId}:${identityKey}`,
      priority: "normal",
      maxAttempts: 3,
    });

    if (job.enqueueState === "enqueue_failed") {
      // Do NOT build HTML in the web request (timeout / crash risk). Leave the
      // generating row; UI can retry and recoverPendingEnqueues may pick it up.
      stage = "share_enqueue_failed";
      logger.warn("report_export_share_enqueue_failed", {
        requestId,
        organizationId,
        businessId,
        reportType,
        reportId: pending.reportId,
        jobId: job.jobId,
        durationMs: Date.now() - started,
      });
      return NextResponse.json(
        {
          error:
            "Report queued but the job broker rejected the enqueue. Retry in a moment — the share record was saved.",
          queued: false,
          status: "generating",
          reportId: pending.reportId,
          shareUrl: pending.shareUrl,
          reportType,
          requestId,
          stage,
        },
        { status: 503 }
      );
    }

    logger.info("report_export_share_queued", {
      requestId,
      organizationId,
      businessId,
      reportType,
      reportId: pending.reportId,
      jobId: job.jobId,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      queued: true,
      status: "generating",
      jobId: job.jobId,
      reportId: pending.reportId,
      shareUrl: pending.shareUrl,
      reportType,
      requestId,
    });
  } catch (err) {
    logger.error("report_export_failed", {
      requestId,
      organizationId,
      businessId,
      reportType,
      stage,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    });
    if (err instanceof Error) {
      const status = exportStatus(err.message);
      if (status !== 500) {
        return NextResponse.json({ error: err.message, requestId, stage }, { status });
      }
    }
    return httpErrorFromException(err, "Export failed");
  }
}
