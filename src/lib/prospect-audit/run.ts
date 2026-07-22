import { createServiceClient } from "@/lib/db/client";
import { findKeywordByText } from "@/lib/maps/scan-queries";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import {
  DEFAULT_MAPS_PROVIDER_MODE,
  scanBatchProviderColumn,
} from "@/lib/maps/provider-modes";
import { DEFAULT_DFS_EXECUTION_MODE } from "@/lib/maps/dfs-execution-modes";
import {
  gridMapCredits,
  hasFeature,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";
import { assertCanEnqueueMapsScan } from "@/lib/queue/fairness";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { ensurePrimaryPrompt } from "@/lib/ai-visibility/engine";
import { logger } from "@/lib/observability/logger";

const MAX_KEYWORDS = 3;
const DEFAULT_GRID_SIZE = 7;

const PARITY_SUMMARY = {
  search_engine: LOCAL_FALCON_PARITY.searchEngine,
  search_this_area: LOCAL_FALCON_PARITY.searchThisArea,
  search_places: LOCAL_FALCON_PARITY.searchPlaces,
  se_domain: LOCAL_FALCON_PARITY.seDomain,
  language_code: LOCAL_FALCON_PARITY.languageCode,
  country_code: LOCAL_FALCON_PARITY.countryCode,
  location_zoom: LOCAL_FALCON_PARITY.locationZoom,
  grid_depth: LOCAL_FALCON_PARITY.gridDepth,
};

export async function startProspectAudit(params: {
  organizationId: string;
  businessId: string;
  keywords: string[];
}): Promise<{
  auditId: string;
  scanBatchIds: string[];
  growthJobId: string | null;
  aiVisibilityJobId: string | null;
  warnings: string[];
}> {
  const keywords = [
    ...new Set(
      params.keywords
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, MAX_KEYWORDS)
    ),
  ];
  if (!keywords.length) {
    throw new Error("Add at least one keyword (up to 3) to run a prospect audit.");
  }

  const supabase = createServiceClient();
  const warnings: string[] = [];
  const scanBatchIds: string[] = [];

  const { data: audit, error: insertErr } = await supabase
    .from("prospect_audits")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      keywords,
      primary_keyword: keywords[0],
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !audit?.id) {
    if (insertErr && /prospect_audits|does not exist/i.test(insertErr.message)) {
      warnings.push("prospect_audits table missing — running scans without persisted audit row");
    } else {
      throw new Error(insertErr?.message ?? "Failed to create prospect audit");
    }
  }

  const auditId = (audit?.id as string | undefined) ?? `ephemeral-${params.businessId}`;

  // Ensure keywords exist on the business
  for (const keyword of keywords) {
    const existing = await findKeywordByText(supabase, params.businessId, keyword);
    if (existing?.id) continue;
    const { error } = await supabase.from("business_keywords").insert({
      business_id: params.businessId,
      keyword,
      is_primary: keyword === keywords[0],
      active: true,
    });
    if (error) {
      warnings.push(`Could not add keyword “${keyword}”: ${error.message}`);
    }
  }

  // --- Maps grids (server-side queue — keep running after the browser leaves) ---
  const { data: business } = await supabase
    .from("businesses")
    .select("scan_center_lat, scan_center_lng, scan_center_label, lat, lng, address_text")
    .eq("id", params.businessId)
    .maybeSingle();

  const centerLat = business?.scan_center_lat ?? business?.lat ?? null;
  const centerLng = business?.scan_center_lng ?? business?.lng ?? null;
  const centerLabel =
    business?.scan_center_label || business?.address_text || null;

  if (
    centerLat == null ||
    centerLng == null ||
    !Number.isFinite(Number(centerLat)) ||
    !Number.isFinite(Number(centerLng)) ||
    (Number(centerLat) === 0 && Number(centerLng) === 0)
  ) {
    throw new Error("Set a scan center on this prospect before running the audit.");
  }

  for (const keyword of keywords) {
    try {
      const kw = await findKeywordByText(supabase, params.businessId, keyword);
      if (!kw?.id) {
        warnings.push(`Skipped Maps scan for “${keyword}” — keyword missing`);
        continue;
      }

      const fairness = await assertCanEnqueueMapsScan({
        organizationId: params.organizationId,
        businessId: params.businessId,
        scanBatchId: "00000000-0000-0000-0000-000000000000",
        keyword,
        gridSize: DEFAULT_GRID_SIZE,
      });
      if (!fairness.ok && (fairness.code === "queued_limit" || fairness.code === "active_limit")) {
        warnings.push(`Maps scan queued later for “${keyword}”: ${fairness.reason}`);
        // Still attempt — fairness may allow after earlier scans drain; if insert fails we warn.
      }

      const creditsNeeded = gridMapCredits(DEFAULT_GRID_SIZE, 0);
      await reserveUsageOrThrow(params.organizationId, "map_credits_used", creditsNeeded);

      try {
        const { data: batch, error: batchErr } = await supabase
          .from("scan_batches")
          .insert({
            business_id: params.businessId,
            status: "queued",
            scan_type: "quick",
            grid_size: DEFAULT_GRID_SIZE,
            radius_meters: DEFAULT_RADIUS_METERS,
            device: LOCAL_FALCON_PARITY.device,
            os: LOCAL_FALCON_PARITY.os,
            browser: LOCAL_FALCON_PARITY.browser,
            provider: scanBatchProviderColumn(DEFAULT_MAPS_PROVIDER_MODE),
            location_id: null,
            center_lat: centerLat,
            center_lng: centerLng,
            center_label: centerLabel,
            confidence_summary: {
              ...PARITY_SUMMARY,
              location_zoom: LOCAL_FALCON_PARITY.locationZoom,
              scan_profile: {
                device: LOCAL_FALCON_PARITY.device,
                os: LOCAL_FALCON_PARITY.os,
                browser: LOCAL_FALCON_PARITY.browser,
              },
              maps_provider_mode: DEFAULT_MAPS_PROVIDER_MODE,
              dfs_execution_mode: DEFAULT_DFS_EXECUTION_MODE,
              keyword_ids: [kw.id],
              keyword_label: keyword,
              method: "live_parallel",
              included_cells: DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE,
              prospect_audit_id: auditId.startsWith("ephemeral-") ? null : auditId,
            },
          })
          .select("id")
          .single();

        if (batchErr || !batch?.id) {
          await releaseUsage(params.organizationId, "map_credits_used", creditsNeeded).catch(
            () => {}
          );
          warnings.push(
            `Could not start Maps scan for “${keyword}”: ${batchErr?.message ?? "unknown"}`
          );
          continue;
        }

        await dispatchScanProcessing({
          scanBatchId: batch.id as string,
          businessId: params.businessId,
          organizationId: params.organizationId,
        });
        scanBatchIds.push(batch.id as string);
      } catch (inner) {
        await releaseUsage(params.organizationId, "map_credits_used", creditsNeeded).catch(
          () => {}
        );
        warnings.push(
          `Maps scan failed for “${keyword}”: ${
            inner instanceof Error ? inner.message : "unknown"
          }`
        );
      }
    } catch (e) {
      warnings.push(
        `Maps scan error for “${keyword}”: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
  }

  // --- Growth Audit (GBP / profile / competitors / website / reviews) ---
  let growthJobId: string | null = null;
  try {
    if (await hasFeature(params.organizationId, "growth_audit")) {
      await reserveUsageOrThrow(params.organizationId, "growth_audits_used", 1);
      const job = await dispatchFeatureJob({
        jobType: "growth_audit_run",
        payload: {
          businessId: params.businessId,
          organizationId: params.organizationId,
          keyword: keywords[0],
          skipBackground: false,
          reservedUsage: { key: "growth_audits_used", amount: 1 },
        },
        organizationId: params.organizationId,
        businessId: params.businessId,
        idempotencyKey: `growth-audit:${params.businessId}:${Math.floor(Date.now() / 30_000)}`,
        priority: "normal",
        maxAttempts: 2,
      });
      if (job.enqueueState === "enqueue_failed") {
        await releaseUsage(params.organizationId, "growth_audits_used", 1).catch(() => {});
        warnings.push("Growth Audit failed to queue");
      } else {
        if (job.reused) {
          await releaseUsage(params.organizationId, "growth_audits_used", 1).catch(() => {});
        }
        growthJobId = job.jobId;
      }
    } else {
      warnings.push("Growth Audit not on plan — skipped profile / competitor scoring");
    }
  } catch (e) {
    warnings.push(
      `Growth Audit not started: ${e instanceof Error ? e.message : "unknown"}`
    );
  }

  // --- AI Visibility ---
  let aiVisibilityJobId: string | null = null;
  try {
    if (await hasFeature(params.organizationId, "ai_visibility")) {
      try {
        await ensurePrimaryPrompt({
          businessId: params.businessId,
          organizationId: params.organizationId,
        });
      } catch (promptErr) {
        warnings.push(
          `AI Visibility prompt setup: ${
            promptErr instanceof Error ? promptErr.message : "skipped"
          }`
        );
      }

      await reserveUsageOrThrow(params.organizationId, "ai_visibility_runs_used", 1);
      const job = await dispatchFeatureJob({
        jobType: "ai_visibility_run",
        payload: {
          businessId: params.businessId,
          organizationId: params.organizationId,
          maxPrompts: 1,
          reservedUsage: { key: "ai_visibility_runs_used", amount: 1 },
        },
        organizationId: params.organizationId,
        businessId: params.businessId,
        idempotencyKey: `ai-visibility:${params.businessId}:${Math.floor(Date.now() / 30_000)}`,
        priority: "normal",
        maxAttempts: 2,
      });
      if (job.enqueueState === "enqueue_failed") {
        await releaseUsage(params.organizationId, "ai_visibility_runs_used", 1).catch(() => {});
        warnings.push("AI Visibility failed to queue");
      } else {
        if (job.reused) {
          await releaseUsage(params.organizationId, "ai_visibility_runs_used", 1).catch(() => {});
        }
        aiVisibilityJobId = job.jobId;
      }
    } else {
      warnings.push("AI Visibility not on plan — skipped");
    }
  } catch (e) {
    warnings.push(
      `AI Visibility not started: ${e instanceof Error ? e.message : "unknown"}`
    );
  }

  if (!auditId.startsWith("ephemeral-")) {
    await attachProspectAuditJobs({
      auditId,
      scanBatchIds,
      status: "running",
    });
    await supabase
      .from("prospect_audits")
      .update({
        summary_json: {
          growthJobId,
          aiVisibilityJobId,
          launchedAt: new Date().toISOString(),
          warnings,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", auditId);
  }

  logger.info("prospect_audit_launched", {
    auditId,
    businessId: params.businessId,
    scanCount: scanBatchIds.length,
    growthJobId,
    aiVisibilityJobId,
    warnings,
  });

  if (!scanBatchIds.length && !growthJobId && !aiVisibilityJobId) {
    throw new Error(
      warnings[0] ?? "Could not start any audit jobs. Check credits, plan, and scan center."
    );
  }

  return {
    auditId,
    scanBatchIds,
    growthJobId,
    aiVisibilityJobId,
    warnings,
  };
}

export async function attachProspectAuditJobs(params: {
  auditId: string;
  growthAuditRunId?: string | null;
  scanBatchIds?: string[];
  status?: "running" | "ready" | "failed" | "shared";
  errorMessage?: string | null;
}) {
  if (params.auditId.startsWith("ephemeral-")) return;
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.growthAuditRunId) patch.growth_audit_run_id = params.growthAuditRunId;
  if (params.scanBatchIds?.length) patch.scan_batch_ids = params.scanBatchIds;
  if (params.status) {
    patch.status = params.status;
    if (params.status === "ready" || params.status === "failed" || params.status === "shared") {
      patch.finished_at = new Date().toISOString();
    }
    if (params.status === "shared") {
      patch.shared_at = new Date().toISOString();
    }
  }
  if (params.errorMessage !== undefined) patch.error_message = params.errorMessage;
  await supabase.from("prospect_audits").update(patch).eq("id", params.auditId);
}

/** Flip running → ready when Maps + Growth pieces have finished (or failed). */
export async function maybeCompleteProspectAudit(
  auditId: string,
  businessId: string
): Promise<"running" | "ready" | "failed"> {
  if (auditId.startsWith("ephemeral-")) return "running";
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("prospect_audits")
    .select("id, status, scan_batch_ids, growth_audit_run_id")
    .eq("id", auditId)
    .maybeSingle();

  if (!row) return "running";
  if (row.status === "ready" || row.status === "shared") return row.status as "ready";
  if (row.status === "failed") return "failed";
  if (row.status !== "running" && row.status !== "draft") {
    return "running";
  }

  const scanIds = ((row.scan_batch_ids as string[]) ?? []).filter(Boolean);
  let scansDone = scanIds.length === 0;
  let anyScanOk = false;
  if (scanIds.length) {
    const { data: batches } = await supabase
      .from("scan_batches")
      .select("id, status")
      .in("id", scanIds);
    const terminal = new Set(["ready", "partial", "rank_ready", "failed", "cancelled"]);
    const ok = new Set(["ready", "partial", "rank_ready"]);
    const rows = batches ?? [];
    scansDone =
      rows.length === scanIds.length && rows.every((b) => terminal.has(String(b.status)));
    anyScanOk = rows.some((b) => ok.has(String(b.status)));
  }

  const { data: growth } = await supabase
    .from("growth_audit_runs")
    .select("id, status")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const growthStatus = String(growth?.status ?? "");
  const growthStillRunning = ["running", "queued", "extended_running"].includes(growthStatus);
  // core_ready is enough for the prospect report; extended modules can finish in background
  const growthUsable = ["complete", "ready", "core_ready", "partial", "extended_ready"].includes(
    growthStatus
  );

  if (scanIds.length && !scansDone) return "running";
  if (growthStillRunning && !growthUsable) return "running";

  const nextStatus: "ready" | "failed" =
    anyScanOk || growthUsable ? "ready" : scanIds.length ? "failed" : "ready";

  await attachProspectAuditJobs({
    auditId,
    growthAuditRunId: (growth?.id as string | undefined) ?? null,
    status: nextStatus,
  });

  return nextStatus;
}

export { MAX_KEYWORDS };
