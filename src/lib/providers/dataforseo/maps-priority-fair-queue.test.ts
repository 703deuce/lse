import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkPreparedMapsRows,
  mapsSubmitPriorityFromJob,
  packFairMapsPostPayload,
  MapsPriorityFairQueue,
  type PreparedMapsPriorityRow,
} from "@/lib/providers/dataforseo/maps-priority-fair-queue";

function fakeRows(n: number, prefix: string): PreparedMapsPriorityRow[] {
  return Array.from({ length: n }, (_, i) => ({
    tag: `${prefix}-${i}`,
    body: { tag: `${prefix}-${i}` },
    request: { priority: 2 },
  }));
}

describe("DataForSEO fair Priority queue", () => {
  it("maps job priorities to submit tiers", () => {
    assert.equal(mapsSubmitPriorityFromJob("highest"), 1);
    assert.equal(mapsSubmitPriorityFromJob("normal"), 2);
    assert.equal(mapsSubmitPriorityFromJob("scheduled"), 3);
    assert.equal(mapsSubmitPriorityFromJob("retry"), 4);
    assert.equal(mapsSubmitPriorityFromJob(undefined), 2);
  });

  it("chunks into 25-cell application slices", () => {
    const rows = fakeRows(225, "c");
    const chunks = chunkPreparedMapsRows(rows, 25);
    assert.equal(chunks.length, 9);
    assert.equal(chunks[0]!.length, 25);
    assert.equal(chunks[8]!.length, 25);
  });

  it("round-robins 25-cell chunks from different scans into one 100-task POST", () => {
    const pending = [
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a0") },
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a1") },
      { scanKey: "B", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "b0") },
      { scanKey: "C", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "c0") },
      { scanKey: "D", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "d0") },
    ];
    const { selected } = packFairMapsPostPayload(pending, { maxTasksPerPost: 100 });
    assert.equal(selected.length, 4);
    assert.equal(selected.reduce((n, c) => n + c.rows.length, 0), 100);
    // Prefer one chunk per scan before a second from A
    const scans = selected.map((c) => c.scanKey);
    assert.deepEqual(scans.slice(0, 4).sort(), ["A", "B", "C", "D"].sort());
  });

  it("does not mix organizations in one POST", () => {
    const pending = [
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a") },
      { scanKey: "B", priority: 1 as const, organizationId: "org2", rows: fakeRows(25, "b") },
    ];
    const { selected } = packFairMapsPostPayload(pending, { maxTasksPerPost: 100 });
    assert.equal(selected.length, 1);
    assert.equal(selected[0]!.organizationId, "org1");
  });

  it("serves higher app priority before lower", () => {
    const pending = [
      { scanKey: "retry", priority: 4 as const, organizationId: "org1", rows: fakeRows(25, "r") },
      { scanKey: "active", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a") },
    ];
    const { selected } = packFairMapsPostPayload(pending, { maxTasksPerPost: 100 });
    assert.equal(selected[0]!.scanKey, "active");
  });

  it("interleaves concurrent scan submissions without waiting for poll", async () => {
    const posts: string[][] = [];
    const queue = new MapsPriorityFairQueue(async (rows) => {
      posts.push(rows.map((r) => r.tag.split("-")[0]!));
      return rows.map((r) => ({
        tag: r.tag,
        taskId: `id-${r.tag}`,
        request: r.request,
      }));
    });

    const prevMin = process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS;
    const prevMax = process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS;
    process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS = "0";
    process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS = "0";

    try {
      const a = queue.submitScanChunks({
        scanKey: "scanA",
        priority: 1,
        organizationId: "org1",
        chunks: [fakeRows(25, "A0"), fakeRows(25, "A1"), fakeRows(25, "A2")],
      });
      const b = queue.submitScanChunks({
        scanKey: "scanB",
        priority: 1,
        organizationId: "org1",
        chunks: [fakeRows(25, "B0"), fakeRows(25, "B1")],
      });

      const [postedA, postedB] = await Promise.all([a, b]);
      assert.equal(postedA.length, 75);
      assert.equal(postedB.length, 50);
      assert.ok(posts.length >= 2);
      for (const post of posts) {
        assert.ok(post.length <= 100);
      }
      // Across the full submit wave both scans must appear (fair packing when concurrent).
      const allTags = new Set(posts.flat());
      assert.ok([...allTags].some((t) => t.startsWith("A")));
      assert.ok([...allTags].some((t) => t.startsWith("B")));
    } finally {
      if (prevMin == null) delete process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS;
      else process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS = prevMin;
      if (prevMax == null) delete process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS;
      else process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS = prevMax;
    }
  });
});
