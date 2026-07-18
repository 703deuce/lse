import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";

describe("customerSafeScanError", () => {
  it("hides Bright Data and API key details", () => {
    const msg = customerSafeScanError(
      "Bright Data returned no map results — check BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE (serp_api1)"
    );
    assert.ok(msg);
    assert.equal(/bright|api_key|serp/i.test(msg!), false);
    assert.match(msg!, /background|recover|later/i);
  });

  it("passes through short actionable messages", () => {
    const msg = customerSafeScanError("Business is not tracked — scheduled scan skipped");
    assert.match(msg!, /archived|inactive|Restore/i);
  });

  it("returns null for empty", () => {
    assert.equal(customerSafeScanError(null), null);
    assert.equal(customerSafeScanError(""), null);
  });
});
