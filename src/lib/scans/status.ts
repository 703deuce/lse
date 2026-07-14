/** Scan statuses where the rank grid map can render from saved cell results. */
export const MAP_RENDERABLE_STATUSES = new Set([
  "rank_ready",
  "enriching",
  "scoring",
  "ai_planning",
  "ready",
  "partial",
]);

/**
 * Terminal (or near-terminal) scans usable as competitor/metrics sources.
 * Most grids finalize at `rank_ready` when enrichment is opt-in — queries that
 * only accept `ready` silently miss the default complete state.
 */
export const USABLE_SCAN_STATUSES = ["ready", "partial", "rank_ready"] as const;

export type UsableScanStatus = (typeof USABLE_SCAN_STATUSES)[number];

/** Poll while rank cells or post-rank pipeline are in flight. */
export const SCAN_POLL_STATUSES = new Set([
  "queued",
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "scoring",
  "ai_planning",
]);

/** Cells still fetching — show pending bubbles. */
export const CELLS_IN_FLIGHT_STATUSES = new Set([
  "queued",
  "dispatching",
  "provider_running",
  "normalizing",
]);

export function isMapRenderable(status: string | null | undefined): boolean {
  return status ? MAP_RENDERABLE_STATUSES.has(status) : false;
}

export function areCellsInFlight(status: string | null | undefined): boolean {
  return status ? CELLS_IN_FLIGHT_STATUSES.has(status) : false;
}

function cellCounters(batch: {
  cells_completed?: number | null;
  cells_total?: number | null;
  cells_failed?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): { completed: number; total: number; failed: number } {
  const conf = (batch.confidence_summary ?? {}) as Record<string, unknown>;
  return {
    completed: Number(batch.cells_completed ?? conf.completed_cells ?? 0),
    total: Number(batch.cells_total ?? conf.total_cells ?? 0),
    failed: Number(batch.cells_failed ?? conf.failed_cells ?? 0),
  };
}

/**
 * Soft-ready promotes to rank_ready while trailing cells retry.
 * Keep the UI poller alive until completed catches up to total (final pass
 * always writes cells_completed = total, even when some points permanently fail).
 */
export function hasTrailingCellsSettling(batch: {
  status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  cells_failed?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): boolean {
  const status = batch.status ?? null;
  if (!status || !isMapRenderable(status)) return false;
  if (areCellsInFlight(status)) return false;
  const { completed, total } = cellCounters(batch);
  return total > 0 && completed < total;
}

/**
 * Rank map should appear only when the grid is fully settled — every point has a
 * saved result. Partial / soft-ready maps caused fake X/20+/gray bubbles while
 * retries were still finishing.
 */
export function isScanMapReady(
  batch: {
    status?: string | null;
    cells_completed?: number | null;
    cells_total?: number | null;
    cells_failed?: number | null;
    confidence_summary?: Record<string, unknown> | null;
  },
  loadedResults: number,
  totalPoints: number
): boolean {
  const status = batch.status ?? null;
  if (!status || status === "failed" || status === "queued") return false;
  if (totalPoints <= 0) return false;

  // Primary signal: status is past cell-fetch + we have a result row per point.
  // Do not require cells_completed to match — that counter can lag the saved rows
  // (or finalize can mark rank_ready a tick before the last status read sees all results).
  if (isMapRenderable(status) && loadedResults >= totalPoints) return true;

  if (areCellsInFlight(status)) return false;
  if (hasTrailingCellsSettling(batch)) return false;

  const { completed, total } = cellCounters(batch);
  const expected = total > 0 ? Math.max(total, totalPoints) : totalPoints;
  return completed >= expected && loadedResults >= totalPoints;
}

/** Keep the client poller alive until the waiting UI can flip to the finished map. */
export function shouldPollForMapReveal(
  status: string | null | undefined,
  loadedResults: number,
  totalPoints: number
): boolean {
  if (!status || status === "failed") return false;
  if (totalPoints <= 0) return false;
  if (areCellsInFlight(status)) return true;
  // rank_ready with a short result set — keep fetching until rows catch up.
  if (loadedResults < totalPoints) return true;
  return false;
}

export function shouldPollScan(
  status: string | null | undefined,
  batch?: {
    cells_completed?: number | null;
    cells_total?: number | null;
    cells_failed?: number | null;
    confidence_summary?: Record<string, unknown> | null;
  }
): boolean {
  if (status && SCAN_POLL_STATUSES.has(status)) return true;
  if (batch && hasCellsPending({ status, ...batch })) return true;
  // Soft-ready → rank_ready while 1–3 edge cells retry; keep polling so the
  // map picks up recovered results instead of leaving those bubbles gray.
  if (batch && hasTrailingCellsSettling({ status, ...batch })) return true;
  return false;
}

export function hasCellsPending(batch: {
  status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): boolean {
  // Only while cells are actively being fetched — not after ready/partial
  // (failed cells leave completed < total forever and must not spin the poller).
  if (!areCellsInFlight(batch.status ?? null)) return false;
  const { completed, total } = cellCounters(batch);
  return total > 0 && completed < total;
}

export function isEnrichmentRunning(batch: {
  status?: string | null;
  enrichment_status?: string | null;
}): boolean {
  if (batch.enrichment_status === "running") return true;
  return batch.status === "enriching" || batch.status === "scoring" || batch.status === "ai_planning";
}

export function isEnrichmentComplete(batch: {
  status?: string | null;
  enrichment_status?: string | null;
}): boolean {
  return (
    batch.enrichment_status === "complete" ||
    batch.status === "ready" ||
    batch.status === "partial"
  );
}

export function scanProgressMessage(batch: {
  status?: string | null;
  enrichment_status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  cells_failed?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): string {
  const conf = (batch.confidence_summary ?? {}) as Record<string, unknown>;
  const completed = Number(batch.cells_completed ?? conf.completed_cells ?? 0);
  const total = Number(batch.cells_total ?? conf.total_cells ?? 0);

  if (areCellsInFlight(batch.status ?? null)) {
    return total > 0
      ? `Scanning ${completed} / ${total} locations…`
      : "Scanning locations…";
  }

  const pending = total > 0 && completed < total ? total - completed : 0;
  if (pending > 0 && isMapRenderable(batch.status ?? null)) {
    return `Finishing scan… ${completed} / ${total} locations ready`;
  }

  if (batch.status === "rank_ready" && batch.enrichment_status === "skipped") {
    return "Rank scan complete.";
  }

  if (batch.status === "rank_ready" || isEnrichmentRunning(batch)) {
    return "Rank scan complete. Enriching competitor details…";
  }

  if (batch.enrichment_status === "failed") {
    return "Rank scan is usable. Competitor enrichment failed — retry enrichment.";
  }

  return "";
}
