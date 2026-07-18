import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  brightDataDelayedRetryDelayMs,
  brightDataDelayedRetryRounds,
} from "@/lib/providers/maps-grid/config";

describe("Bright Data delayed retry config", () => {
  const prevDelay = process.env.BRIGHTDATA_DELAYED_RETRY_DELAY_MS;
  const prevRounds = process.env.BRIGHTDATA_DELAYED_RETRY_ROUNDS;

  before(() => {
    delete process.env.BRIGHTDATA_DELAYED_RETRY_DELAY_MS;
    delete process.env.BRIGHTDATA_DELAYED_RETRY_ROUNDS;
  });

  after(() => {
    if (prevDelay == null) delete process.env.BRIGHTDATA_DELAYED_RETRY_DELAY_MS;
    else process.env.BRIGHTDATA_DELAYED_RETRY_DELAY_MS = prevDelay;
    if (prevRounds == null) delete process.env.BRIGHTDATA_DELAYED_RETRY_ROUNDS;
    else process.env.BRIGHTDATA_DELAYED_RETRY_ROUNDS = prevRounds;
  });

  it("defaults to 30s × 2 rounds", () => {
    assert.equal(brightDataDelayedRetryDelayMs(), 30_000);
    assert.equal(brightDataDelayedRetryRounds(), 2);
  });
});
