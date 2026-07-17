import { createServiceClient } from "@/lib/db/client";

export type CellTelemetryRow = {
  scanBatchId: string;
  scanPointId: string;
  keywordId: string;
  gridLabel: string;
  provider?: string;
  concurrency?: number;
  apiLatencyMs: number;
  matchingMs: number;
  dbSaveMs: number;
  totalMs: number;
  attempts: number;
  success: boolean;
  timedOut: boolean;
  errorMessage?: string | null;
  failureCategory?: string | null;
  providerDiagnostics?: Record<string, unknown> | null;
  distanceFromCenterM?: number | null;
  lat: number;
  lng: number;
  passLabel: string;
};

type SchemaState = {
  checked: boolean;
  hasFailureCategory: boolean;
  hasProviderDiagnostics: boolean;
  warningCount: number;
  lastWarningAt: number;
  lastWarningMessage: string | null;
};

const schemaState: SchemaState = {
  checked: false,
  hasFailureCategory: true,
  hasProviderDiagnostics: true,
  warningCount: 0,
  lastWarningAt: 0,
  lastWarningMessage: null,
};

function noteTelemetryWarning(message: string): void {
  schemaState.warningCount += 1;
  schemaState.lastWarningMessage = message;
  const now = Date.now();
  // Aggregate: log at most once per 30s (plus first warning).
  if (schemaState.warningCount === 1 || now - schemaState.lastWarningAt > 30_000) {
    console.warn(
      `[ScanTelemetry] save degraded (${schemaState.warningCount}x): ${message}`
    );
    schemaState.lastWarningAt = now;
  }
}

/**
 * Best-effort worker-start validation. Never throws — telemetry must not fail scans.
 */
export async function validateScanCellTelemetrySchema(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("scan_cell_telemetry")
      .select("id, failure_category, provider_diagnostics")
      .limit(1);
    if (!error) {
      schemaState.checked = true;
      schemaState.hasFailureCategory = true;
      schemaState.hasProviderDiagnostics = true;
      return;
    }
    const msg = error.message ?? "";
    schemaState.checked = true;
    if (/failure_category/i.test(msg)) schemaState.hasFailureCategory = false;
    if (/provider_diagnostics/i.test(msg)) schemaState.hasProviderDiagnostics = false;
    noteTelemetryWarning(
      `schema probe failed — ${msg}. Apply migration 067/068 and reload PostgREST schema cache.`
    );
  } catch (err) {
    schemaState.checked = true;
    noteTelemetryWarning(err instanceof Error ? err.message : String(err));
  }
}

export async function saveCellTelemetry(row: CellTelemetryRow): Promise<void> {
  if (!schemaState.checked) {
    await validateScanCellTelemetrySchema();
  }

  const supabase = createServiceClient();
  const base = {
    scan_batch_id: row.scanBatchId,
    scan_point_id: row.scanPointId,
    keyword_id: row.keywordId,
    grid_label: row.gridLabel,
    provider: row.provider ?? "brightdata",
    concurrency: row.concurrency ?? null,
    api_latency_ms: Math.round(row.apiLatencyMs),
    matching_ms: Math.round(row.matchingMs),
    db_save_ms: Math.round(row.dbSaveMs),
    total_ms: Math.round(row.totalMs),
    attempts: row.attempts,
    success: row.success,
    timed_out: row.timedOut,
    error_message: row.errorMessage ?? null,
    distance_from_center_m: row.distanceFromCenterM ?? null,
    lat: row.lat,
    lng: row.lng,
    pass_label: row.passLabel,
  };

  const withDiagnostics = {
    ...base,
    ...(schemaState.hasFailureCategory ? { failure_category: row.failureCategory ?? null } : {}),
    ...(schemaState.hasProviderDiagnostics
      ? { provider_diagnostics: row.providerDiagnostics ?? null }
      : {}),
  };

  const { error } = await supabase.from("scan_cell_telemetry").insert(withDiagnostics);
  if (!error) return;

  const msg = error.message ?? "";
  if (/failure_category|provider_diagnostics/i.test(msg)) {
    if (/failure_category/i.test(msg)) schemaState.hasFailureCategory = false;
    if (/provider_diagnostics/i.test(msg)) schemaState.hasProviderDiagnostics = false;
    noteTelemetryWarning(msg);
    const { error: retryError } = await supabase.from("scan_cell_telemetry").insert(base);
    if (retryError) noteTelemetryWarning(retryError.message);
    return;
  }

  noteTelemetryWarning(`${row.gridLabel}: ${msg}`);
}

/** Test helper */
export function __resetTelemetrySchemaStateForTests(): void {
  schemaState.checked = false;
  schemaState.hasFailureCategory = true;
  schemaState.hasProviderDiagnostics = true;
  schemaState.warningCount = 0;
  schemaState.lastWarningAt = 0;
  schemaState.lastWarningMessage = null;
}
