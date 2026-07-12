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
};

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function logCellPhaseTimings(scanBatchId: string, timings: CellPhaseTimings[], concurrency: number) {
  const ok = timings.filter((t) => t.success);
  const failed = timings.length - ok.length;

  for (const t of timings) {
    console.log(
      `[ScanBenchmark] ${t.gridLabel} | Bright Data API: ${t.apiSec}s | matching: ${t.matchingSec}s | db: ${t.dbSaveSec}s | progress: ${t.progressSec}s | total: ${t.totalSec}s` +
        (t.attempts > 1 ? ` | attempts=${t.attempts}` : "") +
        (t.success ? "" : " | FAILED")
    );
  }

  console.log("[ScanBenchmark] ----");
  console.log(
    `[ScanBenchmark] ${timings.length} cells | concurrency=${concurrency} | failed=${failed}`
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

/** Recommended worker pool size by grid cell count. */
export function mapsConcurrencyForCellCount(totalCells: number): number {
  const envCap = Number(process.env.BRIGHTDATA_MAPS_CONCURRENCY ?? process.env.SCRAPINGDOG_MAPS_CONCURRENCY);
  if (Number.isFinite(envCap) && envCap > 0) {
    return Math.min(envCap, 15);
  }
  if (totalCells <= 9) return 9;
  if (totalCells <= 25) return 10;
  return 10;
}

/** Min successful cells before soft rank_ready (map usable while slow edge cells finish). */
export function softReadyMinSuccess(totalCells: number): number {
  const trailing = Number(process.env.GRID_SOFT_READY_TRAILING ?? 3);
  const maxTrailing = Number.isFinite(trailing) && trailing >= 0 ? Math.min(trailing, 10) : 3;
  if (totalCells <= maxTrailing + 1) return totalCells;
  return totalCells - maxTrailing;
}
