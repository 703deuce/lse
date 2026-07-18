import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  getAppBaseUrl,
  isNonPublicAppBase,
  publicReportShareUrl,
  PRODUCTION_APP_URL,
} from "@/lib/app-url";

describe("app-url public share links", () => {
  const keys = ["APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "NODE_ENV"];
  const prev: Record<string, string | undefined> = {};

  before(() => {
    for (const k of keys) prev[k] = process.env[k];
  });

  after(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("detects localhost and private hosts as non-public", () => {
    assert.equal(isNonPublicAppBase("http://localhost:3000"), true);
    assert.equal(isNonPublicAppBase("http://0.0.0.0:3000"), true);
    assert.equal(isNonPublicAppBase("http://10.0.0.8:3000"), true);
    assert.equal(isNonPublicAppBase("http://192.168.1.10:8000"), true);
    assert.equal(isNonPublicAppBase(PRODUCTION_APP_URL), false);
  });

  it("falls back to production host when APP_URL is private in production", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://10.0.0.8:3000";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    assert.equal(getAppBaseUrl(), PRODUCTION_APP_URL);
    assert.equal(
      publicReportShareUrl("abc123"),
      `${PRODUCTION_APP_URL}/reports/share/abc123`
    );
  });

  it("uses configured public APP_URL when valid", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://app.localseoexpress.com";
    assert.equal(
      publicReportShareUrl("tok"),
      "https://app.localseoexpress.com/reports/share/tok"
    );
  });
});
