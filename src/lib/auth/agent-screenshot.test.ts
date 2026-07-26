import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  agentScreenshotSecretMatches,
  getAgentScreenshotEmail,
  isAgentScreenshotConfigured,
} from "@/lib/auth/agent-screenshot";

const PREV = {
  secret: process.env.AGENT_SCREENSHOT_SECRET,
  email: process.env.AGENT_SCREENSHOT_EMAIL,
};

describe("agent screenshot auth helpers", () => {
  beforeEach(() => {
    delete process.env.AGENT_SCREENSHOT_SECRET;
    delete process.env.AGENT_SCREENSHOT_EMAIL;
  });

  afterEach(() => {
    if (PREV.secret === undefined) delete process.env.AGENT_SCREENSHOT_SECRET;
    else process.env.AGENT_SCREENSHOT_SECRET = PREV.secret;
    if (PREV.email === undefined) delete process.env.AGENT_SCREENSHOT_EMAIL;
    else process.env.AGENT_SCREENSHOT_EMAIL = PREV.email;
  });

  it("requires a long secret and valid email", () => {
    assert.equal(isAgentScreenshotConfigured(), false);
    process.env.AGENT_SCREENSHOT_SECRET = "too-short";
    process.env.AGENT_SCREENSHOT_EMAIL = "owner@example.com";
    assert.equal(isAgentScreenshotConfigured(), false);

    process.env.AGENT_SCREENSHOT_SECRET = "a".repeat(32);
    assert.equal(isAgentScreenshotConfigured(), true);
    assert.equal(getAgentScreenshotEmail(), "owner@example.com");
  });

  it("matches secrets in constant time", () => {
    process.env.AGENT_SCREENSHOT_SECRET = "x".repeat(32);
    assert.equal(agentScreenshotSecretMatches("x".repeat(32)), true);
    assert.equal(agentScreenshotSecretMatches("y".repeat(32)), false);
    assert.equal(agentScreenshotSecretMatches(null), false);
  });
});
