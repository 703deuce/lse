import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrivateIp } from "@/lib/validation/ssrf";
import { authorizeBearerSecret, safeEqualSecret } from "@/lib/security/secrets";
import { isCsrfExemptPath, isSameOriginMutation } from "@/lib/security/csrf";
import { escapeCsv } from "@/lib/reporting/metrics";
import { assertRateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";

describe("ASVS code hardenings", () => {
  it("blocks private and metadata IPs for SSRF", () => {
    assert.equal(isPrivateIp("10.0.0.1"), true);
    assert.equal(isPrivateIp("172.16.5.1"), true);
    assert.equal(isPrivateIp("192.168.1.1"), true);
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("169.254.169.254"), true);
    assert.equal(isPrivateIp("100.64.1.1"), true);
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("::1"), true);
    assert.equal(isPrivateIp("fd12::1"), true);
  });

  it("compares secrets in constant-time and rejects query tokens for Bearer auth", () => {
    assert.equal(safeEqualSecret("abc", "abc"), true);
    assert.equal(safeEqualSecret("abc", "abd"), false);
    const ok = authorizeBearerSecret(
      new Request("https://app.example/api/jobs/process?token=wrong", {
        headers: { authorization: "Bearer good-secret" },
      }),
      "good-secret"
    );
    assert.equal(ok.ok, true);
    const bad = authorizeBearerSecret(
      new Request("https://app.example/api/jobs/process?token=good-secret"),
      "good-secret"
    );
    assert.equal(bad.ok, false);
  });

  it("enforces same-origin for mutating API calls", () => {
    assert.equal(isCsrfExemptPath("/api/webhooks/brevo/events"), true);
    assert.equal(isCsrfExemptPath("/api/jobs/process"), true);
    assert.equal(isCsrfExemptPath("/api/scans/create"), false);
    assert.equal(
      isSameOriginMutation({
        method: "POST",
        url: "https://app.example/api/scans/create",
        headers: { get: (n) => (n === "origin" ? "https://evil.example" : null) },
      }),
      false
    );
    assert.equal(
      isSameOriginMutation({
        method: "POST",
        url: "https://app.example/api/scans/create",
        headers: { get: (n) => (n === "origin" ? "https://app.example" : null) },
      }),
      true
    );
  });

  it("neutralizes CSV formula injection", () => {
    assert.equal(escapeCsv("=1+1"), "'=1+1");
    assert.equal(escapeCsv("+cmd"), "'+cmd");
    assert.equal(escapeCsv("-2+3"), "'-2+3");
    assert.equal(escapeCsv("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(escapeCsv("normal"), "normal");
  });

  it("rate-limits expensive routes per key", () => {
    resetRateLimitsForTests();
    assert.equal(assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 }).ok, true);
    assert.equal(assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 }).ok, true);
    assert.equal(assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 }).ok, false);
  });
});
