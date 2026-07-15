/**
 * Global Bright Data capacity control.
 *
 * - Start-rate: how many requests may *begin* per second (all workers)
 * - In-flight: how many may stay open simultaneously
 *
 * When REDIS_URL is set, uses Redis for cross-process coordination.
 * Otherwise falls back to an in-process limiter (single replica only).
 */

import {
  brightDataFairChunkSize,
  brightDataMaxInFlight,
  brightDataStartRatePerSec,
  getRedisUrl,
} from "@/lib/queue/config";

type Slot = { release: () => Promise<void> };

let memoryInFlight = 0;
let memoryWindowStart = Date.now();
let memoryStartsInWindow = 0;

async function getRedis(): Promise<import("ioredis").default | null> {
  const url = getRedisUrl();
  if (!url) return null;
  try {
    const IORedis = (await import("ioredis")).default;
    const client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    if (client.status === "wait") await client.connect();
    return client;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireMemorySlot(timeoutMs: number): Promise<Slot> {
  const deadline = Date.now() + timeoutMs;
  const maxInFlight = brightDataMaxInFlight();
  const startRate = brightDataStartRatePerSec();

  while (Date.now() < deadline) {
    const now = Date.now();
    if (now - memoryWindowStart >= 1000) {
      memoryWindowStart = now;
      memoryStartsInWindow = 0;
    }
    if (memoryInFlight < maxInFlight && memoryStartsInWindow < startRate) {
      memoryInFlight += 1;
      memoryStartsInWindow += 1;
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          memoryInFlight = Math.max(0, memoryInFlight - 1);
        },
      };
    }
    await sleep(20);
  }
  throw new Error("Bright Data capacity timeout — global limiter full");
}

async function acquireRedisSlot(timeoutMs: number): Promise<Slot> {
  const redis = await getRedis();
  if (!redis) return acquireMemorySlot(timeoutMs);

  const deadline = Date.now() + timeoutMs;
  const maxInFlight = brightDataMaxInFlight();
  const startRate = brightDataStartRatePerSec();
  const inFlightKey = "lse:brightdata:inflight";
  const rateKeyPrefix = "lse:brightdata:starts:";

  while (Date.now() < deadline) {
    const second = Math.floor(Date.now() / 1000);
    const rateKey = `${rateKeyPrefix}${second}`;
    const multi = redis.multi();
    multi.incr(inFlightKey);
    multi.incr(rateKey);
    multi.expire(rateKey, 2);
    const results = await multi.exec();
    const inFlight = Number(results?.[0]?.[1] ?? 0);
    const starts = Number(results?.[1]?.[1] ?? 0);

    if (inFlight <= maxInFlight && starts <= startRate) {
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          await redis.decr(inFlightKey).catch(() => {});
        },
      };
    }

    // Roll back speculative incrs
    await redis.decr(inFlightKey).catch(() => {});
    await redis.decr(rateKey).catch(() => {});
    await sleep(25);
  }
  throw new Error("Bright Data capacity timeout — global Redis limiter full");
}

/** Acquire one global provider start slot (rate + in-flight). */
export async function acquireBrightDataSlot(timeoutMs = 30_000): Promise<Slot> {
  if (getRedisUrl()) return acquireRedisSlot(timeoutMs);
  return acquireMemorySlot(timeoutMs);
}

export function fairChunkSize(): number {
  return brightDataFairChunkSize();
}

/** Acquire N slots (best-effort sequential). Releases all on failure. */
export async function acquireBrightDataSlots(
  count: number,
  timeoutMs = 30_000
): Promise<Slot[]> {
  const slots: Slot[] = [];
  try {
    for (let i = 0; i < count; i++) {
      slots.push(await acquireBrightDataSlot(timeoutMs));
    }
    return slots;
  } catch (err) {
    await Promise.all(slots.map((s) => s.release()));
    throw err;
  }
}
