/** Scan statuses where the rank grid map can render from saved cell results. */
export const MAP_RENDERABLE_STATUSES = new Set([
  "rank_ready",
  "enriching",
  "scoring",
  "ai_planning",
  "ready",
  "partial",
]);

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

export function shouldPollScan(
  status: string | null | undefined,
  batch?: {
    cells_completed?: number | null;
    cells_total?: number | null;
    confidence_summary?: Record<string, unknown> | null;
  }
): boolean {
  if (status && SCAN_POLL_STATUSES.has(status)) return true;
  if (batch && hasCellsPending({ status, ...batch })) return true;
  return false;
}

export function areCellsInFlight(status: string | null | undefined): boolean {
  return status ? CELLS_IN_FLIGHT_STATUSES.has(status) : false;
}

export function hasCellsPending(batch: {
  status?: string | null;
  cells_completed?: number | null;
  cells_total?: number | null;
  confidence_summary?: Record<string, unknown> | null;
}): boolean {
  const conf = (batch.confidence_summary ?? {}) as Record<string, unknown>;
  const completed = Number(batch.cells_completed ?? conf.completed_cells ?? 0);
  const total = Number(batch.cells_total ?? conf.total_cells ?? 0);
  return isMapRenderable(batch.status ?? null) && total > 0 && completed < total;
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
  const failed = Number(batch.cells_failed ?? conf.failed_cells ?? 0);

  if (areCellsInFlight(batch.status ?? null)) {
    return total > 0
      ? `${completed} / ${total} locations analyzed · Showing results as they arrive.`
      : "Scanning locations…";
  }

  const pending = total > 0 && completed < total ? total - completed : 0;
  if (pending > 0 && isMapRenderable(batch.status ?? null)) {
    return `${completed} / ${total} locations analyzed · ${pending} still scanning…`;
  }

  if (batch.status === "rank_ready" || isEnrichmentRunning(batch)) {
    const failNote = failed > 0 ? ` (${failed} point${failed === 1 ? "" : "s"} failed)` : "";
    return `Rank scan complete${failNote}. Enriching competitor details…`;
  }

  if (batch.enrichment_status === "failed") {
    return "Rank scan is usable. Competitor enrichment failed — retry enrichment.";
  }

  return "";
}
