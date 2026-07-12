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
  distanceFromCenterM?: number | null;
  lat: number;
  lng: number;
  passLabel: string;
};

export async function saveCellTelemetry(row: CellTelemetryRow): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("scan_cell_telemetry").insert({
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
  });
  if (error) {
    console.warn("[ScanTelemetry] save failed:", row.gridLabel, error.message);
  }
}
