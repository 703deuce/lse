import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEngineFailure,
  engineStatusLabel,
  isEngineFailureStatus,
  isSuccessfulAiRunStatus,
} from "@/lib/ai-visibility/engine-status";

describe("ai visibility engine status", () => {
  it("treats completed_with_errors as a successful run", () => {
    assert.equal(isSuccessfulAiRunStatus("complete"), true);
    assert.equal(isSuccessfulAiRunStatus("completed_with_errors"), true);
    assert.equal(isSuccessfulAiRunStatus("failed"), false);
  });

  it("classifies rate limits and timeouts", () => {
    assert.equal(classifyEngineFailure("Cloro 429 concurrency limit").status, "rate_limited");
    assert.equal(classifyEngineFailure("request timed out").status, "timed_out");
    assert.equal(classifyEngineFailure("CLORO_API_KEY not configured").status, "skipped");
    assert.equal(
      classifyEngineFailure("Anthropic 400 (invalid_request_error): bad tool").status,
      "provider_failed"
    );
  });

  it("labels engine failures for UI", () => {
    assert.equal(engineStatusLabel("rate_limited"), "Rate limited");
    assert.equal(isEngineFailureStatus("provider_failed"), true);
    assert.equal(isEngineFailureStatus("complete"), false);
  });
});
