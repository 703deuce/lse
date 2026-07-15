import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JOB_LIFECYCLE,
  canTransitionLifecycle,
  deriveLifecycleStatus,
  isTerminalLifecycle,
} from "@/lib/platform/job-lifecycle";
import { getCache, resetCacheForTests } from "@/lib/cache";
import { cacheKey, tenantCacheKey } from "@/lib/cache/config";
import { classifyProviderError } from "@/lib/providers/gateway";
import { ProviderTimeoutError } from "@/lib/providers/fetch-with-timeout";

describe("job lifecycle", () => {
  it("allows queued → running → completed", () => {
    assert.equal(canTransitionLifecycle("queued", "running"), true);
    assert.equal(canTransitionLifecycle("running", "completed"), true);
    assert.equal(canTransitionLifecycle("completed", "running"), false);
  });

  it("derives lifecycle from legacy status fields", () => {
    assert.equal(
      deriveLifecycleStatus({ status: "pending", enqueueState: "enqueued" }),
      JOB_LIFECYCLE.QUEUED
    );
    assert.equal(
      deriveLifecycleStatus({ status: "failed", enqueueState: "enqueued" }),
      JOB_LIFECYCLE.PERMANENTLY_FAILED
    );
    assert.equal(isTerminalLifecycle("dead_letter"), true);
  });
});

describe("cache driver", () => {
  it("memory getOrSet is single-flight and tenant-keyed", async () => {
    const prev = process.env.CACHE_DRIVER;
    process.env.CACHE_DRIVER = "memory";
    resetCacheForTests();
    const cache = getCache();
    let builds = 0;
    const key = tenantCacheKey("org-1", "dash", "summary");
    assert.ok(key.startsWith("org:org-1:dash"));
    assert.equal(cacheKey(["a", "b"]), "a:b");

    const [a, b] = await Promise.all([
      cache.getOrSet(key, async () => {
        builds += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { v: 1 };
      }, { ttlMs: 5_000 }),
      cache.getOrSet(key, async () => {
        builds += 1;
        return { v: 2 };
      }, { ttlMs: 5_000 }),
    ]);
    assert.deepEqual(a, b);
    assert.equal(builds, 1);

    if (prev === undefined) delete process.env.CACHE_DRIVER;
    else process.env.CACHE_DRIVER = prev;
    resetCacheForTests();
  });
});

describe("provider gateway classification", () => {
  it("marks timeouts retryable and invalid permanent", () => {
    assert.equal(
      classifyProviderError(new ProviderTimeoutError("brightdata", 1000)),
      "retryable"
    );
    assert.equal(classifyProviderError(new Error("Invalid business")), "permanent");
  });
});
