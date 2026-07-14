import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export type RetentionResult = {
  telemetryDeleted: number;
  providerRunsScrubbed: number;
  jobsDeleted: number;
  workspaceCacheDeleted: number;
  sharesRevoked: number;
};

const RETENTION_INTERVAL_MS = Number(process.env.RETENTION_INTERVAL_MS ?? 60 * 60 * 1000);
let lastRetentionAt = 0;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Delete / scrub operational data on the existing Coolify cron path.
 * Defaults are conservative; override with RETENTION_*_DAYS env vars.
 */
export async function runDataRetentionCleanup(): Promise<RetentionResult> {
  const supabase = createServiceClient();
  const telemetryDays = Number(process.env.RETENTION_TELEMETRY_DAYS ?? 30);
  const providerRawDays = Number(process.env.RETENTION_PROVIDER_RAW_DAYS ?? 14);
  const jobsDays = Number(process.env.RETENTION_JOBS_DAYS ?? 14);
  const workspaceDays = Number(process.env.RETENTION_WORKSPACE_CACHE_DAYS ?? 7);

  let telemetryDeleted = 0;
  let providerRunsScrubbed = 0;
  let jobsDeleted = 0;
  let workspaceCacheDeleted = 0;
  let sharesRevoked = 0;

  const { data: telemetry } = await supabase
    .from("scan_cell_telemetry")
    .delete()
    .lt("created_at", daysAgoIso(telemetryDays))
    .select("id");
  telemetryDeleted = telemetry?.length ?? 0;

  const { data: scrubbed } = await supabase
    .from("provider_runs")
    .update({ raw_request_json: null, raw_response_json: null })
    .lt("created_at", daysAgoIso(providerRawDays))
    .or("raw_request_json.not.is.null,raw_response_json.not.is.null")
    .select("id");
  providerRunsScrubbed = scrubbed?.length ?? 0;

  const { data: jobs } = await supabase
    .from("job_queue")
    .delete()
    .in("status", ["completed", "failed"])
    .lt("finished_at", daysAgoIso(jobsDays))
    .select("id");
  jobsDeleted = jobs?.length ?? 0;

  const { data: cache } = await supabase
    .from("scan_workspace_cache")
    .delete()
    .lt("updated_at", daysAgoIso(workspaceDays))
    .select("id");
  workspaceCacheDeleted = cache?.length ?? 0;

  const { data: shares } = await supabase
    .from("reports")
    .update({ share_token: null })
    .not("share_token", "is", null)
    .lt("share_expires_at", new Date().toISOString())
    .select("id");
  sharesRevoked = shares?.length ?? 0;

  const result = {
    telemetryDeleted,
    providerRunsScrubbed,
    jobsDeleted,
    workspaceCacheDeleted,
    sharesRevoked,
  };

  logger.info("data_retention_cleanup", result);
  return result;
}

/** At most once per RETENTION_INTERVAL_MS per process. */
export async function maybeRunDataRetentionCleanup(): Promise<RetentionResult | null> {
  const now = Date.now();
  if (now - lastRetentionAt < RETENTION_INTERVAL_MS) return null;
  lastRetentionAt = now;
  try {
    return await runDataRetentionCleanup();
  } catch (err) {
    logger.error("data_retention_cleanup_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
