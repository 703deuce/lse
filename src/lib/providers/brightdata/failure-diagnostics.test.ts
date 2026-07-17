import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyBrightDataMapsResponse,
  detectBodyMarkers,
  humanMessageForCategory,
  redactProviderText,
} from "@/lib/providers/brightdata/failure-diagnostics";

describe("Bright Data failure diagnostics", () => {
  it("redacts bearer tokens and keeps useful preview length", () => {
    const raw = `Bearer super-secret-token-value Authorization: Bearer abc123 ${"x".repeat(2000)}`;
    const out = redactProviderText(raw, 200);
    assert.ok(!out.toLowerCase().includes("super-secret"));
    assert.ok(out.includes("[REDACTED]") || out.includes("Bearer [REDACTED]"));
    assert.ok(out.length <= 201);
  });

  it("detects consent and challenge markers", () => {
    const consent = detectBodyMarkers("Before you continue to Google we use cookies");
    assert.equal(consent.consent, true);

    const challenge = detectBodyMarkers("Our systems have detected unusual traffic from your computer network captcha");
    assert.equal(challenge.unusualTraffic, true);
    assert.equal(challenge.captcha, true);
  });

  it("classifies empty organic JSON as empty_maps_results", () => {
    const d = classifyBrightDataMapsResponse({
      httpStatus: 200,
      contentType: "application/json",
      bodyText: JSON.stringify({ organic: [] }),
      latencyMs: 15200,
      zone: "serp_api1",
      organicCount: 0,
    });
    assert.equal(d.category, "empty_maps_results");
    assert.equal(d.latencyMs, 15200);
    assert.ok((d.schemaKeys ?? []).includes("organic"));
    assert.equal(humanMessageForCategory(d.category).includes("no map results"), true);
  });

  it("classifies Google consent HTML separately from generic empty results", () => {
    const d = classifyBrightDataMapsResponse({
      httpStatus: 200,
      contentType: "text/html",
      bodyText: "<!DOCTYPE html><html>Before you continue to Google Consent</html>",
      latencyMs: 12000,
      zone: "serp_api1",
    });
    assert.equal(d.category, "google_consent_page");
  });

  it("classifies provider error payloads", () => {
    const d = classifyBrightDataMapsResponse({
      httpStatus: 200,
      contentType: "application/json",
      bodyText: JSON.stringify({ error: "No more results", code: "no_results" }),
      latencyMs: 9000,
      zone: "serp_api1",
    });
    assert.equal(d.category, "provider_error_payload");
    assert.equal(d.providerErrorCode, "no_results");
  });

  it("classifies HTTP errors with status preserved", () => {
    const d = classifyBrightDataMapsResponse({
      httpStatus: 502,
      contentType: "application/json",
      bodyText: JSON.stringify({ error: "Bad gateway" }),
      latencyMs: 45000,
      zone: "serp_api1",
    });
    assert.equal(d.category, "http_error");
    assert.equal(d.httpStatus, 502);
    assert.match(humanMessageForCategory(d.category, { status: 502, detail: "Bad gateway" }), /HTTP 502/);
  });

  it("classifies unexpected schema when JSON has no Maps keys", () => {
    const d = classifyBrightDataMapsResponse({
      httpStatus: 200,
      contentType: "application/json",
      bodyText: JSON.stringify({ foo: 1, bar: 2 }),
      latencyMs: 8000,
      organicCount: 0,
    });
    assert.equal(d.category, "unexpected_schema");
  });
});
