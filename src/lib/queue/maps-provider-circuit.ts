/**
 * Distributed Bright Data (Maps) circuit with lease/expiry.
 * States: closed → degraded → open → half_open → closed
 */

import { getRedisUrl } from "@/lib/queue/config";
import {
  brightDataCircuitLeaseMs,
  brightDataDegradedMinFailures,
  brightDataDegradedThresholdPercent,
  brightDataDegradedWindowMs,
} from "@/lib/providers/maps-grid/config";
import {
  isProviderDegradationPattern,
  type MapsFailureCategory,
} from "@/lib/providers/maps-grid/failure-categories";
import type { MapsCircuitState, MapsProviderId } from "@/lib/providers/maps-grid/types";

type CircuitSnapshot = {
  state: MapsCircuitState;
  openedAt: number;
  expiresAt: number;
  reason: string | null;
  failureCount: number;
  attemptCount: number;
};

type WindowSample = { at: number; failure: boolean; degradation: boolean };

const memoryCircuits = new Map<MapsProviderId, CircuitSnapshot>();
const memoryWindows = new Map<MapsProviderId, WindowSample[]>();

let sharedRedis: import("ioredis").default | null = null;
let sharedRedisConnecting: Promise<import("ioredis").default | null> | null = null;

async function getRedis(): Promise<import("ioredis").default | null> {
  const url = getRedisUrl();
  if (!url) return null;
  if (sharedRedis && sharedRedis.status !== "end" && sharedRedis.status !== "close") {
    return sharedRedis;
  }
  if (sharedRedisConnecting) return sharedRedisConnecting;
  sharedRedisConnecting = (async () => {
    try {
      const IORedis = (await import("ioredis")).default;
      const client = new IORedis(url, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      if (client.status === "wait") await client.connect();
      sharedRedis = client;
      client.on("end", () => {
        if (sharedRedis === client) sharedRedis = null;
      });
      return client;
    } catch {
      sharedRedis = null;
      return null;
    } finally {
      sharedRedisConnecting = null;
    }
  })();
  return sharedRedisConnecting;
}

function defaultClosed(): CircuitSnapshot {
  return {
    state: "closed",
    openedAt: 0,
    expiresAt: 0,
    reason: null,
    failureCount: 0,
    attemptCount: 0,
  };
}

function circuitKey(provider: MapsProviderId): string {
  return `lse:provider:${provider}:maps:circuit`;
}

function windowKey(provider: MapsProviderId): string {
  return `lse:provider:${provider}:maps:window`;
}

function applyExpiry(snap: CircuitSnapshot): CircuitSnapshot {
  if (snap.state === "closed") return snap;
  if (snap.expiresAt > 0 && Date.now() > snap.expiresAt) {
    return defaultClosed();
  }
  return snap;
}

async function readCircuit(provider: MapsProviderId): Promise<CircuitSnapshot> {
  const redis = await getRedis();
  if (!redis) {
    return applyExpiry(memoryCircuits.get(provider) ?? defaultClosed());
  }
  try {
    const raw = await redis.get(circuitKey(provider));
    if (!raw) return defaultClosed();
    return applyExpiry(JSON.parse(raw) as CircuitSnapshot);
  } catch {
    return applyExpiry(memoryCircuits.get(provider) ?? defaultClosed());
  }
}

async function writeCircuit(provider: MapsProviderId, snap: CircuitSnapshot): Promise<void> {
  memoryCircuits.set(provider, snap);
  const redis = await getRedis();
  if (!redis) return;
  const ttlSec = Math.max(5, Math.ceil(brightDataCircuitLeaseMs() / 1000));
  await redis.set(circuitKey(provider), JSON.stringify(snap), "EX", ttlSec).catch(() => {});
}

export async function getMapsProviderCircuit(
  provider: MapsProviderId = "brightdata"
): Promise<CircuitSnapshot> {
  return readCircuit(provider);
}

export async function setMapsProviderCircuit(
  provider: MapsProviderId,
  state: MapsCircuitState,
  reason?: string
): Promise<CircuitSnapshot> {
  const now = Date.now();
  const snap: CircuitSnapshot = {
    state,
    openedAt: state === "closed" ? 0 : now,
    expiresAt: state === "closed" ? 0 : now + brightDataCircuitLeaseMs(),
    reason: reason ?? null,
    failureCount: 0,
    attemptCount: 0,
  };
  await writeCircuit(provider, snap);
  console.warn(`[MapsCircuit] ${provider} → ${state}${reason ? ` (${reason})` : ""}`);
  return snap;
}

async function pushWindowSample(
  provider: MapsProviderId,
  sample: WindowSample
): Promise<WindowSample[]> {
  const windowMs = brightDataDegradedWindowMs();
  const redis = await getRedis();
  if (!redis) {
    const arr = memoryWindows.get(provider) ?? [];
    arr.push(sample);
    const pruned = arr.filter((s) => sample.at - s.at <= windowMs);
    memoryWindows.set(provider, pruned);
    return pruned;
  }
  try {
    const key = windowKey(provider);
    await redis.lpush(key, JSON.stringify(sample));
    await redis.ltrim(key, 0, 499);
    await redis.pexpire(key, windowMs + 5_000);
    const raw = await redis.lrange(key, 0, 499);
    return raw
      .map((r) => {
        try {
          return JSON.parse(r) as WindowSample;
        } catch {
          return null;
        }
      })
      .filter((s): s is WindowSample => !!s && sample.at - s.at <= windowMs);
  } catch {
    const arr = memoryWindows.get(provider) ?? [];
    arr.push(sample);
    const pruned = arr.filter((s) => sample.at - s.at <= windowMs);
    memoryWindows.set(provider, pruned);
    return pruned;
  }
}

export type DegradationDecision = {
  shouldDegrade: boolean;
  failureCount: number;
  attemptCount: number;
  degradationCount: number;
  percent: number;
};

export function evaluateDegradationWindow(
  samples: Array<{ failure: boolean; degradation: boolean }>,
  opts?: { minFailures?: number; thresholdPercent?: number }
): DegradationDecision {
  const minFailures = opts?.minFailures ?? brightDataDegradedMinFailures();
  const threshold = opts?.thresholdPercent ?? brightDataDegradedThresholdPercent();
  const attemptCount = samples.length;
  const failureCount = samples.filter((s) => s.failure).length;
  const degradationCount = samples.filter((s) => s.degradation).length;
  const percent = attemptCount > 0 ? (degradationCount / attemptCount) * 100 : 0;
  return {
    shouldDegrade:
      degradationCount >= minFailures && percent >= threshold && attemptCount >= minFailures,
    failureCount,
    attemptCount,
    degradationCount,
    percent,
  };
}

/**
 * Record a cell attempt outcome. Returns whether degraded mode should open.
 */
export async function recordMapsProviderAttempt(params: {
  provider?: MapsProviderId;
  success: boolean;
  category: MapsFailureCategory;
}): Promise<DegradationDecision & { circuit: CircuitSnapshot }> {
  const provider = params.provider ?? "brightdata";
  const degradation = !params.success && isProviderDegradationPattern(params.category);
  const samples = await pushWindowSample(provider, {
    at: Date.now(),
    failure: !params.success,
    degradation,
  });
  const decision = evaluateDegradationWindow(samples);
  let circuit = await readCircuit(provider);

  if (decision.shouldDegrade && (circuit.state === "closed" || circuit.state === "half_open")) {
    circuit = await setMapsProviderCircuit(
      provider,
      "degraded",
      `${decision.degradationCount}/${decision.attemptCount} degradation failures (${Math.round(decision.percent)}%)`
    );
  }

  return { ...decision, circuit };
}

export async function shouldSkipBrightDataPrimary(): Promise<boolean> {
  const circuit = await getMapsProviderCircuit("brightdata");
  return circuit.state === "open";
}

export function __resetMapsProviderCircuitForTests(): void {
  memoryCircuits.clear();
  memoryWindows.clear();
}
