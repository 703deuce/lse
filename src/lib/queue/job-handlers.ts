/**
 * Single execution registry for all job types.
 * Used by BullMQ workers and the database-driver cron claimer.
 */
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { runScanEnrichment } from "@/lib/jobs/run-scan-enrichment";
import { maybeRunDataRetentionCleanup } from "@/lib/jobs/retention";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";
import { runLocalTrustFinder } from "@/lib/local-trust/engine";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/engine";
import { runCitationAudit } from "@/lib/citations/engine";
import { runReputationAudit } from "@/lib/reputation/engine";
import { runGrowthAudit } from "@/lib/growth-audit/engine";
import { runExtendedModulesInBackground } from "@/lib/growth-audit/background";
import { runReviewMomentum } from "@/lib/reviews/momentum-engine";
import { enqueueDueCampaignMessages } from "@/lib/reputation/campaign-processor";
import { sendCampaignMessageById } from "@/lib/reputation/campaign-message-send";
import { processNewReviewAlerts } from "@/lib/reputation/review-alerts";
import {
  runContactImport,
  type ContactImportMode,
  type ContactImportRow,
} from "@/lib/reputation/contact-import";
import { processIntegrationWebhookEvent } from "@/lib/integrations/webhook-process";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import { releaseUsage } from "@/lib/plans";
import { logger } from "@/lib/observability/logger";
import type { QueueName } from "@/lib/queue/types";

export type JobHandlerPayload = Record<string, unknown> & {
  ledgerJobId?: string;
  organizationId?: string;
  businessId?: string;
  reservedUsage?: { key: string; amount: number };
};

export type JobHandlerResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
  /** When false, do not mark ledger completed (another worker owns work). */
  markComplete?: boolean;
};

const PERMANENT_PATTERN =
  /not found|required|invalid|access denied|not included|unauthorized|unsupported|disabled|incomplete/i;

export function jobTypeToQueue(jobType: string): QueueName {
  switch (jobType) {
    case "process_scan":
    case "maps_difficulty_run":
    case "scan_enrichment":
    case "early_enrichment":
    case "keyword_check":
    case "keyword_volume":
      return "maps-scan";
    case "retry_scan_cells":
      return "maps-cell-retry";
    case "import_contacts":
    case "integration_webhook_process":
      return "review-import";
    case "campaign_send_batch":
      return "review-campaign";
    case "send_campaign_email":
      return "email-send";
    case "send_campaign_sms":
      return "sms-send";
    case "review_alert_scan":
    case "reputation_audit":
    case "review_momentum_run":
      return "review-monitor";
    case "backlink_gap_run":
      return "backlink-gap";
    case "local_trust_run":
      return "local-trust";
    case "ai_visibility_run":
      return "ai-visibility";
    case "generate_report":
      return "report-generation";
    case "send_notification":
      return "notifications";
    case "citation_audit":
    case "growth_audit_run":
    case "growth_audit_extended":
    case "gbp_audit_module":
    case "data_retention":
    default:
      return "maintenance";
  }
}

export async function executeJobType(
  jobType: string,
  payload: JobHandlerPayload
): Promise<JobHandlerResult> {
  try {
    switch (jobType) {
      case "process_scan":
      case "retry_scan_cells": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        const orgId = await resolveOrgId(payload);
        try {
          const outcome = await processScanBatch(scanBatchId, orgId);
          if (outcome === "deferred") return { ok: true, markComplete: false };
          return { ok: true, markComplete: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Scan failed";
          if (orgId) {
            const { maybeReleaseUnusedMapCredits, PRE_PROVIDER_FAIL } = await import(
              "@/lib/jobs/map-credits"
            );
            await maybeReleaseUnusedMapCredits(scanBatchId, orgId, message).catch(() => {});
            if (PRE_PROVIDER_FAIL.test(message)) return permanent(message);
          }
          throw err;
        }
      }
      case "scan_enrichment": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        await runScanEnrichment(scanBatchId, await resolveOrgId(payload));
        return { ok: true };
      }
      case "early_enrichment": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        const { processEarlyEnrichment } = await import("@/lib/jobs/run-early-enrichment");
        await processEarlyEnrichment(scanBatchId, await resolveOrgId(payload));
        return { ok: true };
      }
      case "keyword_check": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("keyword_check payload incomplete");
        const { runKeywordChecks } = await import("@/lib/keyword-tracker/engine");
        await runKeywordChecks({
          businessId,
          organizationId,
          keywordIds: Array.isArray(payload.keywordIds)
            ? (payload.keywordIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "keyword_volume": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("keyword_volume payload incomplete");
        const { refreshKeywordVolumes } = await import("@/lib/keyword-tracker/engine");
        await refreshKeywordVolumes({
          businessId,
          organizationId,
          keywordIds: Array.isArray(payload.keywordIds)
            ? (payload.keywordIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "send_notification": {
        // Placeholder: transactional fan-out will land here; drains currently use specialized job types.
        logger.info("send_notification_noop", { payloadKeys: Object.keys(payload) });
        return { ok: true };
      }
      case "import_contacts": {
        const uploadId = String(payload.uploadId ?? "");
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!uploadId || !businessId || !organizationId) {
          return permanent("import_contacts payload incomplete");
        }
        const supabase = createServiceClient();
        const { data: upload } = await supabase
          .from("review_request_uploads")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", uploadId)
          .in("status", ["queued", "running"])
          .select("rows_json, mode")
          .maybeSingle();
        if (!upload) return permanent("Import upload not found or already finished");
        const rows = (upload.rows_json ?? []) as ContactImportRow[];
        try {
          await runContactImport({
            organizationId,
            businessId,
            uploadId,
            mode:
              (payload.mode as ContactImportMode) ??
              (upload.mode as ContactImportMode) ??
              "update",
            rows,
          });
          return { ok: true };
        } catch (err) {
          await supabase
            .from("review_request_uploads")
            .update({
              status: "failed",
              error_report_json: [
                {
                  row: 0,
                  error: err instanceof Error ? err.message : "Import failed",
                },
              ],
              completed_at: new Date().toISOString(),
            })
            .eq("id", uploadId)
            .eq("status", "running");
          throw err;
        }
      }
      case "integration_webhook_process": {
        const eventId = String(payload.eventId ?? payload.relatedResourceId ?? "");
        if (!eventId) return permanent("Missing webhook eventId");
        const result = await processIntegrationWebhookEvent(eventId);
        if (!result.ok && result.permanent) return permanent(result.error ?? "Webhook failed");
        if (!result.ok) return { ok: false, error: result.error ?? "Webhook processing failed" };
        return { ok: true };
      }
      case "campaign_send_batch": {
        // Orchestrator only — find due messages and enqueue email/sms jobs.
        const limit = Number(payload.limit ?? 100);
        await enqueueDueCampaignMessages(Number.isFinite(limit) ? limit : 100);
        return { ok: true };
      }
      case "send_campaign_email":
      case "send_campaign_sms": {
        const messageId = String(payload.messageId ?? payload.relatedResourceId ?? "");
        if (!messageId) return permanent("Missing messageId");
        const result = await sendCampaignMessageById(messageId);
        if (result.ok) return { ok: true };
        if (result.permanent) return permanent(result.error ?? "Send failed permanently");
        return { ok: false, error: result.error ?? "Send failed" };
      }
      case "review_alert_scan": {
        const limit = Number(payload.limit ?? 15);
        await processNewReviewAlerts(Number.isFinite(limit) ? limit : 15);
        return { ok: true };
      }
      case "local_trust_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("local_trust payload incomplete");
        await runLocalTrustFinder({
          businessId,
          organizationId,
          city: optionalString(payload.city),
          state: optionalString(payload.state),
          county: optionalString(payload.county),
          rescan: Boolean(payload.rescan),
        });
        return { ok: true };
      }
      case "backlink_gap_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("backlink_gap payload incomplete");
        const result = await runBacklinkGap({
          businessId,
          organizationId,
          scanBatchId: optionalString(payload.scanBatchId),
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          selectedCompetitorIds: Array.isArray(payload.selectedCompetitorIds)
            ? (payload.selectedCompetitorIds as string[])
            : undefined,
          forceRefresh: Boolean(payload.forceRefresh),
        });
        if (result.fromCache && payload.reservedUsage) {
          await releaseUsage(
            organizationId,
            payload.reservedUsage.key as Parameters<typeof releaseUsage>[1],
            payload.reservedUsage.amount
          ).catch(() => {});
        }
        return { ok: true };
      }
      case "ai_visibility_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("ai_visibility payload incomplete");
        await runAiVisibilityCheck({
          businessId,
          organizationId,
          maxPrompts: typeof payload.maxPrompts === "number" ? payload.maxPrompts : 1,
          promptIds: Array.isArray(payload.promptIds)
            ? (payload.promptIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "citation_audit": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("citation_audit payload incomplete");
        await runCitationAudit({
          businessId,
          organizationId,
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          vertical: optionalString(payload.vertical),
          forceRefresh: Boolean(payload.forceRefresh),
        });
        return { ok: true };
      }
      case "reputation_audit": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("reputation_audit payload incomplete");
        await runReputationAudit({
          businessId,
          organizationId,
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          lookbackDays:
            typeof payload.lookbackDays === "number" ? payload.lookbackDays : undefined,
          forceRefresh: Boolean(payload.forceRefresh),
        });
        return { ok: true };
      }
      case "growth_audit_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("growth_audit payload incomplete");
        await runGrowthAudit({
          businessId,
          organizationId,
          keyword: optionalString(payload.keyword),
          // Engine enqueues growth_audit_extended unless skipBackground is set.
          skipBackground: Boolean(payload.skipBackground),
        });
        return { ok: true };
      }
      case "growth_audit_extended": {
        const growthRunId = String(payload.growthRunId ?? "");
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!growthRunId || !businessId || !organizationId) {
          return permanent("growth_audit_extended payload incomplete");
        }
        await runExtendedModulesInBackground({ growthRunId, businessId, organizationId });
        return { ok: true };
      }
      case "review_momentum_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("review_momentum payload incomplete");
        await runReviewMomentum({
          businessId,
          organizationId,
          scanBatchId: optionalString(payload.scanBatchId),
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          lookbackDays:
            typeof payload.lookbackDays === "number" ? payload.lookbackDays : undefined,
        });
        return { ok: true };
      }
      case "maps_difficulty_run": {
        const { processMapsDifficultyJob } = await import("@/lib/maps-difficulty/run-job");
        const keyword = String(payload.keyword ?? "").trim();
        const lat = Number(payload.lat);
        const lng = Number(payload.lng);
        const organizationId = String(payload.organizationId ?? "");
        if (!keyword || !Number.isFinite(lat) || !Number.isFinite(lng) || !organizationId) {
          return permanent("maps_difficulty payload incomplete");
        }
        await processMapsDifficultyJob({
          organizationId,
          keyword,
          lat,
          lng,
          label: String(payload.label ?? keyword),
          service: optionalString(payload.service),
          address: optionalString(payload.address),
          businessBaseAddress: optionalString(payload.businessBaseAddress),
          businessBase:
            payload.businessBase && typeof payload.businessBase === "object"
              ? (payload.businessBase as {
                  lat?: number;
                  lng?: number;
                  label?: string;
                  error?: string;
                })
              : null,
        });
        return { ok: true };
      }
      case "generate_report": {
        const businessId = String(payload.businessId ?? "");
        if (!businessId) return permanent("generate_report payload incomplete");
        const reportType = optionalString(payload.reportType) ?? "single_scan";
        await generateTypedReport({
          businessId,
          scanBatchId: optionalString(payload.scanBatchId),
          reportType: reportType as import("@/lib/reporting/types").ReportType,
          keywordId: optionalString(payload.keywordId),
          locationId: optionalString(payload.locationId),
          campaignId: optionalString(payload.campaignId),
          gridSize: typeof payload.gridSize === "number" ? payload.gridSize : undefined,
          radiusMeters:
            typeof payload.radiusMeters === "number" ? payload.radiusMeters : undefined,
          selectedCompetitorKeys: Array.isArray(payload.selectedCompetitorKeys)
            ? (payload.selectedCompetitorKeys as string[])
            : undefined,
          persist: payload.persist !== false,
        });
        return { ok: true };
      }
      case "gbp_audit_module": {
        const businessId = String(payload.businessId ?? "");
        const module = String(payload.module ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !module) return permanent("gbp_audit_module payload incomplete");
        if (organizationId) {
          const supabase = createServiceClient();
          const { data: biz } = await supabase
            .from("businesses")
            .select("organization_id")
            .eq("id", businessId)
            .maybeSingle();
          if (!biz || biz.organization_id !== organizationId) {
            return permanent("gbp_audit_module tenant mismatch");
          }
        }
        const { executeAuditModule, isAuditModule } = await import("@/lib/audit/run-module");
        if (!isAuditModule(module)) return permanent("Unknown GBP audit module");
        const result = await executeAuditModule({
          businessId,
          module,
          keyword: optionalString(payload.keyword),
        });
        const ledgerJobId =
          (typeof payload.ledgerJobId === "string" && payload.ledgerJobId) ||
          (typeof payload.jobId === "string" && payload.jobId) ||
          null;
        if (ledgerJobId) {
          const { updateJobProgress } = await import("@/lib/queue/ledger");
          await updateJobProgress(ledgerJobId, { result, module });
          const supabase = createServiceClient();
          await supabase
            .from("job_queue")
            .update({ result_ref: `module_audits:${businessId}:${module}` })
            .eq("id", ledgerJobId);
        }
        return { ok: true };
      }
      case "data_retention": {
        await maybeRunDataRetentionCleanup();
        return { ok: true };
      }
      default:
        return permanent(`No handler registered for job type ${jobType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("job_handler_failed", { jobType, error: message });
    // Do not release reservedUsage on retryable errors — processor releases only on terminal failure.
    if (PERMANENT_PATTERN.test(message)) {
      return { ok: false, permanent: true, error: message };
    }
    return { ok: false, permanent: false, error: message };
  }
}

function permanent(error: string): JobHandlerResult {
  return { ok: false, permanent: true, error };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

async function resolveOrgId(payload: JobHandlerPayload): Promise<string | undefined> {
  if (typeof payload.organizationId === "string" && payload.organizationId) {
    return payload.organizationId;
  }
  if (typeof payload.businessId !== "string" || !payload.businessId) return undefined;
  const supabase = createServiceClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", payload.businessId)
    .maybeSingle();
  return (biz?.organization_id as string | undefined) ?? undefined;
}
