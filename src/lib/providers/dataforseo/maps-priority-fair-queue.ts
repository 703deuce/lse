/**
 * Fair DataForSEO Maps Priority submission scheduler.
 *
 * Two layers:
 *   1. Application chunk — default 25 cells per scan reservation
 *   2. DataForSEO POST — up to 100 tasks (combine up to four 25-cell chunks)
 *
 * Concurrent scans round-robin within a priority tier so a 15×15 cannot
 * monopolize the wire ahead of a 5×5. POSTs are paced 50–100ms apart and
 * never wait for task completion before the next POST.
 */

import {
  dataForSeoMapsAppChunkSize,
  dataForSeoMapsMaxTasksPerPost,
  dataForSeoMapsPostDelayMaxMs,
  dataForSeoMapsPostDelayMinMs,
} from "@/lib/providers/maps-grid/config";
import type { JobPriorityClass } from "@/lib/queue/types";

/** App-level submit priority (1 = user waiting, 4 = retries). */
export type MapsSubmitPriority = 1 | 2 | 3 | 4;

export function mapsSubmitPriorityFromJob(
  priority?: JobPriorityClass | MapsSubmitPriority | string | number | null
): MapsSubmitPriority {
  if (priority === 1 || priority === "highest" || priority === "active") return 1;
  if (priority === 2 || priority === "normal" || priority === "paid") return 2;
  if (priority === 3 || priority === "scheduled" || priority === "background") return 3;
  if (priority === 4 || priority === "lower" || priority === "retry") return 4;
  return 2;
}

export type PreparedMapsPriorityRow = {
  tag: string;
  body: Record<string, unknown>;
  request: Record<string, unknown> & { priority: number };
};

export type PostedMapsPriorityRow = {
  tag: string;
  taskId: string;
  request: PreparedMapsPriorityRow["request"];
};

export type FairQueueChunk = {
  scanKey: string;
  priority: MapsSubmitPriority;
  organizationId?: string;
  rows: PreparedMapsPriorityRow[];
};

export type PostOneMapsPriorityFn = (
  rows: PreparedMapsPriorityRow[],
  organizationId?: string
) => Promise<PostedMapsPriorityRow[]>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postDelayMs(): number {
  const min = dataForSeoMapsPostDelayMinMs();
  const max = dataForSeoMapsPostDelayMaxMs();
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Split prepared rows into application fairness chunks (default 25). */
export function chunkPreparedMapsRows<T>(
  rows: T[],
  chunkSize = dataForSeoMapsAppChunkSize()
): T[][] {
  const size = Math.max(1, Math.min(chunkSize, dataForSeoMapsMaxTasksPerPost()));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

type InternalChunk = FairQueueChunk & {
  id: string;
  resolve: (posted: PostedMapsPriorityRow[]) => void;
  reject: (err: unknown) => void;
};

/**
 * Pure packer used by the dispatcher and unit tests.
 *
 * Prefers the best (lowest) priority tier, then round-robins across scans,
 * taking one chunk per scan before a second chunk from the same scan.
 * Only combines chunks that share the same organizationId (cost attribution).
 */
export function packFairMapsPostPayload(
  pending: FairQueueChunk[],
  opts?: { maxTasksPerPost?: number; startScanIndex?: number }
): { selected: FairQueueChunk[]; nextScanIndex: number } {
  if (!pending.length) return { selected: [], nextScanIndex: 0 };

  const maxTasks = opts?.maxTasksPerPost ?? dataForSeoMapsMaxTasksPerPost();
  const bestPriority = Math.min(...pending.map((c) => c.priority)) as MapsSubmitPriority;
  const tier = pending.filter((c) => c.priority === bestPriority);

  const orgCounts = new Map<string, number>();
  for (const c of tier) {
    const key = c.organizationId ?? "";
    orgCounts.set(key, (orgCounts.get(key) ?? 0) + c.rows.length);
  }
  let orgKey = "";
  let orgBest = -1;
  for (const [k, n] of orgCounts) {
    if (n > orgBest) {
      orgBest = n;
      orgKey = k;
    }
  }
  const orgTier = tier.filter((c) => (c.organizationId ?? "") === orgKey);

  const byScan = new Map<string, FairQueueChunk[]>();
  const scanOrder: string[] = [];
  for (const chunk of orgTier) {
    if (!byScan.has(chunk.scanKey)) {
      byScan.set(chunk.scanKey, []);
      scanOrder.push(chunk.scanKey);
    }
    byScan.get(chunk.scanKey)!.push(chunk);
  }

  if (!scanOrder.length) return { selected: [], nextScanIndex: 0 };

  let rr = ((opts?.startScanIndex ?? 0) % scanOrder.length + scanOrder.length) % scanOrder.length;
  const selected: FairQueueChunk[] = [];
  let taskCount = 0;
  let idleRounds = 0;

  while (taskCount < maxTasks && idleRounds < scanOrder.length) {
    const scanKey = scanOrder[rr]!;
    const queue = byScan.get(scanKey) ?? [];
    const next = queue[0];
    if (!next || taskCount + next.rows.length > maxTasks) {
      idleRounds += 1;
      rr = (rr + 1) % scanOrder.length;
      continue;
    }
    queue.shift();
    selected.push(next);
    taskCount += next.rows.length;
    idleRounds = 0;
    rr = (rr + 1) % scanOrder.length;
  }

  return { selected, nextScanIndex: rr };
}

/**
 * Process-local fair dispatcher. Concurrent Priority scans in the same worker
 * interleave 25-cell chunks into ≤100-task POSTs.
 */
export class MapsPriorityFairQueue {
  private pending: InternalChunk[] = [];
  private draining = false;
  private rrIndex = 0;
  private chunkSeq = 0;
  private readonly postOne: PostOneMapsPriorityFn;

  constructor(postOne: PostOneMapsPriorityFn) {
    this.postOne = postOne;
  }

  /** Tests only. */
  resetForTests(): void {
    this.pending = [];
    this.draining = false;
    this.rrIndex = 0;
  }

  pendingChunkCount(): number {
    return this.pending.length;
  }

  /**
   * Enqueue all application chunks for one scan; resolves when every chunk
   * has been POSTed (not when DataForSEO tasks finish).
   */
  async submitScanChunks(params: {
    scanKey: string;
    priority?: MapsSubmitPriority;
    organizationId?: string;
    chunks: PreparedMapsPriorityRow[][];
  }): Promise<PostedMapsPriorityRow[]> {
    const priority = params.priority ?? 2;
    const scanKey = params.scanKey || `anon-${Date.now()}`;
    if (!params.chunks.length) return [];

    const promises = params.chunks.map(
      (rows) =>
        new Promise<PostedMapsPriorityRow[]>((resolve, reject) => {
          this.pending.push({
            id: `${scanKey}:${++this.chunkSeq}`,
            scanKey,
            priority,
            organizationId: params.organizationId,
            rows,
            resolve,
            reject,
          });
        })
    );

    void this.drain();
    const parts = await Promise.all(promises);
    return parts.flat();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const { selected, nextScanIndex } = packFairMapsPostPayload(this.pending, {
          startScanIndex: this.rrIndex,
        });
        this.rrIndex = nextScanIndex;

        if (!selected.length) {
          // Should not happen with app chunks ≤ maxPerPost; fail safe.
          const head = this.pending.shift();
          if (head) {
            head.reject(new Error("DataForSEO fair queue could not pack pending chunk"));
          }
          continue;
        }

        const selectedIds = new Set((selected as InternalChunk[]).map((c) => c.id));
        this.pending = this.pending.filter((c) => !selectedIds.has(c.id));

        const internal = selected as InternalChunk[];
        const rows = internal.flatMap((c) => c.rows);
        const organizationId = internal[0]?.organizationId;

        try {
          const posted = await this.postOne(rows, organizationId);
          const byTag = new Map(posted.map((p) => [p.tag, p] as const));
          for (const chunk of internal) {
            chunk.resolve(
              chunk.rows
                .map((r) => byTag.get(r.tag))
                .filter((p): p is PostedMapsPriorityRow => Boolean(p))
            );
          }
        } catch (err) {
          for (const chunk of internal) {
            chunk.reject(err);
          }
        }

        if (this.pending.length > 0) {
          await sleep(postDelayMs());
        }
      }
    } finally {
      this.draining = false;
      if (this.pending.length > 0) {
        void this.drain();
      }
    }
  }
}

let sharedQueue: MapsPriorityFairQueue | null = null;

export function getMapsPriorityFairQueue(postOne: PostOneMapsPriorityFn): MapsPriorityFairQueue {
  if (!sharedQueue) {
    sharedQueue = new MapsPriorityFairQueue(postOne);
  }
  return sharedQueue;
}

/** Tests only — replace the singleton. */
export function setMapsPriorityFairQueueForTests(queue: MapsPriorityFairQueue | null): void {
  sharedQueue = queue;
}
