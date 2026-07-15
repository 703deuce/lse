/**
 * Per-process database operation concurrency (brief Part 7 / 11).
 * Keeps provider fan-out from also opening unlimited DB writes.
 */

const max = Math.max(1, Number(process.env.DB_OP_CONCURRENCY ?? 12) || 12);
let inFlight = 0;
const waiters: Array<() => void> = [];

function pump() {
  while (inFlight < max && waiters.length) {
    const next = waiters.shift();
    if (next) next();
  }
}

export async function withDbLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= max) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlight += 1;
  try {
    return await fn();
  } finally {
    inFlight -= 1;
    pump();
  }
}

export function dbLimiterStats() {
  return { inFlight, waiting: waiters.length, max };
}
