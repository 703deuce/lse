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
 * Soft-ready / mid-pass state while retries or integrity can still rewrite ranks.
 * Keep the UI poller alive so 20+/stale pins do not freeze before final upserts.
 */
export function isGridPassStillSettling(batch: {
  confidence_summary?: Record<string, unknown> | null;
}): boolean {
  const pass = String((batch.confidence_summary as { pass?: unknown } | null)?.pass ?? "");
  if (!pass || pass === "complete") return false;
  return /^(primary|retry|integrity)/i.test(pass);
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
  if (isGridPassStillSettling(batch)) return true;
  const { completed, total } = cellCounters(batch);
  return total > 0 && completed < total;
}

type MapReadyBatch = {
  status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  cells_failed?: number | null;
  finished_at?: string | null;
  rank_ready_at?: string | null;
  confidence_summary?: Record<string, unknown> | null;
};

/**
 * Rank map should appear only when the grid is fully settled — every point has a
 * saved result. Partial / soft-ready maps caused fake X/20+/gray bubbles while
 * retries were still finishing.
 *
 * This is the single source of truth for both "show the map" and "stop polling".
 */
export function isScanMapReady(
  batch: MapReadyBatch,
  loadedResults: number,
  totalPoints: number
): boolean {
  const status = batch.status ?? null;
  if (!status || status === "failed" || status === "queued") return false;
  if (totalPoints <= 0) return false;
  if (areCellsInFlight(status)) return false;

  // Retries/integrity can still overwrite ranks — do not freeze the map pins yet
  // even if soft-ready already set rank_ready_at / finished_at.
  if (isGridPassStillSettling(batch)) return false;

  const { completed, total, failed } = cellCounters(batch);
  // Failed cells never get scan_results rows — count them as settled.
  const settledResults = loadedResults + Math.max(0, failed);
  if (settledResults < totalPoints) {
    // Counters may say the pass finished even when some results are missing.
    const expected = total > 0 ? Math.max(total, totalPoints) : totalPoints;
    if (completed < expected) return false;
  }

  // Terminal / near-terminal grid status, or an explicit finish timestamp.
  if (isMapRenderable(status)) return true;
  if (batch.finished_at || batch.rank_ready_at) return true;

  const expected = total > 0 ? Math.max(total, totalPoints) : totalPoints;
  return completed >= expected;
}

/**
 * Keep polling until isScanMapReady is true (or the batch failed).
 * Do not use a looser stop condition than the wait UI — that was the stuck bug.
 */
export function shouldPollUntilMapReady(
  batch: MapReadyBatch,
  loadedResults: number,
  totalPoints: number
): boolean {
  const status = batch.status ?? null;
  if (!status || status === "failed") return false;
  return !isScanMapReady(batch, loadedResults, totalPoints);
}

/** @deprecated Prefer shouldPollUntilMapReady — kept for older call sites. */
export function shouldPollForMapReveal(
  status: string | null | undefined,
  loadedResults: number,
  totalPoints: number
): boolean {
  return shouldPollUntilMapReady({ status }, loadedResults, totalPoints);
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
  const pass = String(conf.pass ?? "");

  if (areCellsInFlight(batch.status ?? null)) {
    if (total > 0 && completed >= total) {
      return "Creating your map…";
    }
    if (pass.startsWith("retry") || pass === "integrity") {
      return total > 0
        ? `Retrying remaining locations… ${completed} / ${total} ready`
        : "Retrying remaining locations…";
    }
    return total > 0
      ? `Scanning ${completed} / ${total} locations…`
      : "Scanning locations…";
  }

  if (batch.status === "normalizing") {
    return "Creating your map…";
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

/** Wait-screen phase while the rank map is still hidden. */
export type ScanWaitPhase = "scanning" | "retrying" | "creating_map";

export function scanWaitPhase(batch: {
  status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): ScanWaitPhase {
  const conf = (batch.confidence_summary ?? {}) as Record<string, unknown>;
  const completed = Number(batch.cells_completed ?? conf.completed_cells ?? 0);
  const total = Number(batch.cells_total ?? conf.total_cells ?? 0);
  const pass = String(conf.pass ?? "");
  const status = batch.status ?? null;

  if (status === "normalizing" || pass === "complete") return "creating_map";
  if (total > 0 && completed >= total) return "creating_map";
  if (pass.startsWith("retry") || pass === "integrity") return "retrying";
  return "scanning";
}
