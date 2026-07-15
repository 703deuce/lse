import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getQueueDriverName,
  getRedisUrl,
  getQueueConfig,
  QUEUE_CONFIGS,
  brightDataFairChunkSize,
} from "@/lib/queue/config";
import { PRIORITY_SCORES } from "@/lib/queue/types";
import { scheduleJitterMs } from "@/lib/queue/schedule-jitter";
import {
  nextPollIntervalMs,
  isTerminalJobStatus,
  derivePhase,
} from "@/lib/jobs/active-job-status";

describe("queue config", () => {
  it("defaults QUEUE_DRIVER to database when unset or unknown", () => {
    const prev = process.env.QUEUE_DRIVER;
    delete process.env.QUEUE_DRIVER;
    assert.equal(getQueueDriverName(), "database");
    process.env.QUEUE_DRIVER = "nonsense";
    assert.equal(getQueueDriverName(), "database");
    if (prev === undefined) delete process.env.QUEUE_DRIVER;
    else process.env.QUEUE_DRIVER = prev;
  });

  it("requires explicit QUEUE_DRIVER=bullmq (ignores REDIS_URL alone)", () => {
    const prevDriver = process.env.QUEUE_DRIVER;
    const prevRedis = process.env.REDIS_URL;
    process.env.QUEUE_DRIVER = "database";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    assert.equal(getQueueDriverName(), "database");
    assert.equal(getQueueConfig().driver, "database");
    process.env.QUEUE_DRIVER = "bullmq";
    assert.equal(getQueueDriverName(), "bullmq");
    assert.equal(getRedisUrl(), "redis://127.0.0.1:6379");
    if (prevDriver === undefined) delete process.env.QUEUE_DRIVER;
    else process.env.QUEUE_DRIVER = prevDriver;
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
  });

  it("exposes isolated named queues", () => {
    assert.equal(QUEUE_CONFIGS["maps-scan"].name, "maps-scan");
    assert.equal(QUEUE_CONFIGS["report-generation"].name, "report-generation");
    assert.ok(QUEUE_CONFIGS["maps-scan"].concurrency >= 1);
    assert.ok(QUEUE_CONFIGS.notifications.maxAttempts >= 1);
    assert.ok(brightDataFairChunkSize() >= 1);
    assert.ok(brightDataFairChunkSize() <= 100);
  });

  it("orders priority classes highest < normal < lower", () => {
    assert.ok(PRIORITY_SCORES.highest < PRIORITY_SCORES.normal);
    assert.ok(PRIORITY_SCORES.normal < PRIORITY_SCORES.lower);
  });

  it("getRedisUrl returns null when empty", () => {
    if (!process.env.REDIS_URL?.trim()) {
      assert.equal(getRedisUrl(), null);
    }
  });
});

describe("schedule jitter", () => {
  it("is deterministic per seed and stays inside the window", () => {
    const a = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-a:campaign-1",
    });
    const b = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-a:campaign-1",
    });
    const c = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-b:campaign-1",
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(a >= 1_000_000);
    assert.ok(a < 1_000_000 + 3_600_000 + 1000);
  });
});

describe("active job status helpers", () => {
  it("uses adaptive intervals and terminal detection", () => {
    const start = 1_000_000;
    assert.equal(nextPollIntervalMs(start, start, start + 5_000), 1500);
    assert.equal(nextPollIntervalMs(start, start, start + 90_000), 5000);
    assert.ok(nextPollIntervalMs(start, start - 60_000, start + 200_000) >= 10_000);
    assert.equal(isTerminalJobStatus("completed"), true);
    assert.equal(isTerminalJobStatus("provider_running"), false);
    assert.equal(derivePhase("queued"), "queued");
    assert.equal(derivePhase("failed"), "failed");
    assert.equal(derivePhase("provider_running"), "active");
  });
});
