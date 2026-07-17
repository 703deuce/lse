export function elapsedSec(start: number): number {
  return Math.round((performance.now() - start) / 100) / 10;
}

export type CellPhaseTimings = {
  gridLabel: string;
  apiSec: number;
  matchingSec: number;
  dbSaveSec: number;
  progressSec: number;
  totalSec: number;
  success: boolean;
  attempts: number;
  failureCategory?: string | null;
};

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function logCellPhaseTimings(
  scanBatchId: string,
  timings: CellPhaseTimings[],
  concurrency: number,
  uniqueCells?: number
) {
  const ok = timings.filter((t) => t.success);
  const failed = timings.length - ok.length;
  const uniqueLabels = new Set(timings.map((t) => t.gridLabel));
  const initialFailures = timings.filter((t) => !t.success).length;
  const cellCount = uniqueCells ?? uniqueLabels.size;

  for (const t of timings) {
    console.log(
      `[ScanBenchmark] ${t.gridLabel} | Bright Data API: ${t.apiSec}s | matching: ${t.matchingSec}s | db: ${t.dbSaveSec}s | progress: ${t.progressSec}s | total: ${t.totalSec}s` +
        (t.attempts > 1 ? ` | attempts=${t.attempts}` : "") +
        (t.success ? "" : " | FAILED") +
        (!t.success && t.failureCategory ? ` | category=${t.failureCategory}` : "")
    );
  }

  console.log("[ScanBenchmark] ----");
  console.log(
    `[ScanBenchmark] ${cellCount} unique cells | ${timings.length} attempts | concurrency=${concurrency} | initial failures=${initialFailures} | failed attempts=${failed}`
  );
  console.log(
    `[ScanBenchmark] avg API=${avg(ok.map((t) => t.apiSec))}s matching=${avg(ok.map((t) => t.matchingSec))}s db=${avg(ok.map((t) => t.dbSaveSec))}s progress=${avg(ok.map((t) => t.progressSec))}s total=${avg(ok.map((t) => t.totalSec))}s`
  );

  const sumCellSec = timings.reduce((sum, t) => sum + t.totalSec, 0);
  const theoreticalSerial = avg(ok.map((t) => t.totalSec)) * timings.length;
  console.log(
    `[ScanBenchmark] scan=${scanBatchId} sum_cell_time=${Math.round(sumCellSec)}s theoretical_serial=${Math.round(theoreticalSerial)}s`
  );
}

/**
 * Recommended in-scan pool size by grid cell count.
 * Prefer mapsGridConcurrency() in live paths — this helper stays for tools/tests.
 */
export function mapsConcurrencyForCellCount(totalCells: number): number {
  const envCap = Number(
    process.env.BRIGHTDATA_MAPS_CONCURRENCY ??
      process.env.BRIGHTDATA_GRID_BATCH_SIZE ??
      process.env.SCRAPINGDOG_MAPS_CONCURRENCY
  );
  if (Number.isFinite(envCap) && envCap > 0) {
    return Math.min(Math.floor(envCap), 100, Math.max(totalCells, 1));
  }
  return Math.min(Math.max(totalCells, 1), 100);
}

/**
 * Min successful cells before soft rank_ready.
 * Default trailing=0: wait until every cell settles (incl. retries) before rank_ready.
 * Set GRID_SOFT_READY_TRAILING (e.g. 3) only if you want an early map again.
 */
export function softReadyMinSuccess(totalCells: number): number {
  const trailing = Number(process.env.GRID_SOFT_READY_TRAILING ?? 0);
  const maxTrailing = Number.isFinite(trailing) && trailing >= 0 ? Math.min(trailing, 10) : 0;
  if (maxTrailing === 0 || totalCells <= maxTrailing + 1) return totalCells;
  return totalCells - maxTrailing;
}
