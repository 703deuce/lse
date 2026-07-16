import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordUsage } from "@/lib/platform/usage-ledger";

describe("usage ledger", () => {
  it("exports recordUsage that accepts idempotencyKey without throwing", async () => {
    // Best-effort: without DB this warns and returns; must not throw into callers.
    await recordUsage({
      organizationId: "00000000-0000-0000-0000-000000000000",
      feature: "maps_grid_cell",
      provider: "brightdata",
      unitType: "request",
      actualUnits: 1,
      estimatedCostUsd: 0.0015,
      actualCostUsd: 0.0015,
      idempotencyKey: "brightdata:maps_grid_cell:test:point:kw",
    });
    assert.ok(true);
  });
});
