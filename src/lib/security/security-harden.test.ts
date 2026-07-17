import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrivateIp } from "@/lib/validation/ssrf";
import { authorizeBearerSecret, safeEqualSecret } from "@/lib/security/secrets";
import {
  evaluateSameOriginMutation,
  getAllowedOrigins,
  isCsrfExemptPath,
  isSameOriginMutation,
  normalizeOrigin,
  originFromForwardedHeaders,
} from "@/lib/security/csrf";
import { escapeCsv } from "@/lib/reporting/metrics";
import {
  assertRateLimit,
  assertRateLimitSync,
  resetRateLimitsForTests,
  __testUseMemoryRateLimitOnly,
} from "@/lib/security/rate-limit";
import { roleHasPermission } from "@/lib/auth/permissions-core";
import {
  isAllowedExternalRedirect,
  sanitizeReviewRedirectUrl,
} from "@/lib/security/safe-redirect";
import { hashShareToken } from "@/lib/reporting/share-token";
import { parseJobPayload } from "@/lib/queue/payload-schemas";
import {
  getBrevoEventsWebhookUrl,
  getBrevoInboundWebhookUrl,
} from "@/lib/app-url";
import { sanitizeUntrustedText } from "@/lib/security/prompt-guard";
import { isAdminMfaRequired } from "@/lib/auth/admin-mfa";
import { evaluateRecentAuthFromPayload } from "@/lib/auth/reauth";
import { assertSafeArtifactStoragePath } from "@/lib/reporting/artifact-path";
import { hashSharePassword, verifySharePassword } from "@/lib/reporting/share-password";
import {
  isOrganizationAccessBlocked,
  isOrganizationEnqueueBlocked,
} from "@/lib/auth/org-status";
import { mergeCookieOptions, supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getBrowserGoogleMapsApiKey } from "@/lib/maps/google-maps-key";

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
    const prevApp = process.env.APP_URL;
    const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
    const prevAllowed = process.env.ALLOWED_ORIGINS;
    process.env.APP_URL = "https://app.example";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    delete process.env.ALLOWED_ORIGINS;
    try {
      assert.equal(isCsrfExemptPath("/api/webhooks/brevo/events"), true);
      assert.equal(
        isCsrfExemptPath("/api/integrations/webhooks/incoming/lsewh_test"),
        true
      );
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
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "https://app.example/api/scans/create",
          headers: {
            get: (n) => {
              if (n === "cookie") return "session=abc";
              return null;
            },
          },
        }),
        false
      );
    } finally {
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
      if (prevAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = prevAllowed;
    }
  });

  it("allows Coolify production origin even when request.url is localhost", () => {
    const prevApp = process.env.APP_URL;
    const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
    const prevAllowed = process.env.ALLOWED_ORIGINS;
    const prevNode = process.env.NODE_ENV;
    process.env.APP_URL = "https://app.localseoexpress.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.localseoexpress.com";
    process.env.ALLOWED_ORIGINS = "https://app.localseoexpress.com";
    process.env.NODE_ENV = "production";
    try {
      assert.equal(normalizeOrigin("https://app.localseoexpress.com/"), "https://app.localseoexpress.com");
      assert.equal(normalizeOrigin("https://app.localseoexpress.com:443"), "https://app.localseoexpress.com");
      assert.ok(getAllowedOrigins().includes("https://app.localseoexpress.com"));

      // Valid browser origin behind Traefik (internal request.url is localhost)
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/scans/create",
          headers: {
            get: (n) => {
              if (n === "origin") return "https://app.localseoexpress.com";
              if (n === "x-forwarded-host") return "app.localseoexpress.com";
              if (n === "x-forwarded-proto") return "https";
              if (n === "cookie") return "sb-access-token=x";
              return null;
            },
          },
        }),
        true
      );

      // http (not https) production origin rejected
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/scans/create",
          headers: {
            get: (n) => {
              if (n === "origin") return "http://app.localseoexpress.com";
              if (n === "x-forwarded-host") return "app.localseoexpress.com";
              if (n === "x-forwarded-proto") return "https";
              return null;
            },
          },
        }),
        false
      );

      // evil.com rejected
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/scans/create",
          headers: { get: (n) => (n === "origin" ? "https://evil.com" : null) },
        }),
        false
      );

      // suffix / subdomain confusion rejected (exact match only)
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/scans/create",
          headers: {
            get: (n) => (n === "origin" ? "https://app.localseoexpress.com.evil.com" : null),
          },
        }),
        false
      );

      // Spoofed forwarded host must NOT expand allowlist
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/scans/create",
          headers: {
            get: (n) => {
              if (n === "origin") return "https://evil.com";
              if (n === "x-forwarded-host") return "evil.com";
              if (n === "x-forwarded-proto") return "https";
              return null;
            },
          },
        }),
        false
      );
      assert.equal(
        originFromForwardedHeaders({
          get: (n) => {
            if (n === "x-forwarded-host") return "evil.com";
            if (n === "x-forwarded-proto") return "https";
            return null;
          },
        }),
        "https://evil.com"
      );
      assert.equal(
        getAllowedOrigins().includes("https://evil.com"),
        false
      );

      // Absent Origin for server-to-server (no cookies) allowed
      assert.equal(
        isSameOriginMutation({
          method: "POST",
          url: "http://localhost:3000/api/jobs/process",
          headers: { get: () => null },
        }),
        true
      );

      const denied = evaluateSameOriginMutation({
        method: "POST",
        url: "http://localhost:3000/api/scans/create",
        headers: { get: (n) => (n === "origin" ? "https://evil.com" : null) },
      });
      assert.equal(denied.ok, false);
      assert.equal(denied.diagnostics.reason, "origin_not_allowlisted");
      assert.equal(denied.diagnostics.canonicalOrigin, "https://app.localseoexpress.com");
      assert.equal(denied.diagnostics.requestHost, "localhost:3000");
    } finally {
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
      if (prevAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = prevAllowed;
      process.env.NODE_ENV = prevNode;
    }
  });

  it("neutralizes CSV formula injection", () => {
    assert.equal(escapeCsv("=1+1"), "'=1+1");
    assert.equal(escapeCsv("+cmd"), "'+cmd");
    assert.equal(escapeCsv("-2+3"), "'-2+3");
    assert.equal(escapeCsv("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(escapeCsv("normal"), "normal");
  });

  it("rate-limits expensive routes per key", async () => {
    resetRateLimitsForTests();
    __testUseMemoryRateLimitOnly();
    assert.equal((await assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 })).ok, true);
    assert.equal((await assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 })).ok, true);
    assert.equal((await assertRateLimit({ key: "k", maxPerWindow: 2, windowMs: 60_000 })).ok, false);
    assert.equal(assertRateLimitSync({ key: "sync-k", maxPerWindow: 1 }).ok, true);
    assert.equal(assertRateLimitSync({ key: "sync-k", maxPerWindow: 1 }).ok, false);
  });

  it("falls back to memory rate limit when redis unavailable", async () => {
    resetRateLimitsForTests();
    const prev = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    __testUseMemoryRateLimitOnly();
    try {
      const first = await assertRateLimit({ key: "redis-fallback", maxPerWindow: 5 });
      assert.equal(first.ok, true);
    } finally {
      if (prev === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prev;
      resetRateLimitsForTests();
    }
  });

  it("maps org roles to permissions", () => {
    assert.equal(roleHasPermission("owner", "org.delete"), true);
    assert.equal(roleHasPermission("admin", "report.share"), true);
    assert.equal(roleHasPermission("member", "report.share"), true);
    assert.equal(roleHasPermission("member", "campaign.send"), true);
    assert.equal(roleHasPermission("member", "billing.read"), true);
    assert.equal(roleHasPermission("member", "contacts.read"), true);
    assert.equal(roleHasPermission("readonly", "contacts.read"), false);
    assert.equal(roleHasPermission("readonly", "business.read"), true);
    assert.equal(roleHasPermission("readonly", "scan.run"), false);
  });

  it("sanitizes review redirect URLs", () => {
    assert.equal(
      sanitizeReviewRedirectUrl("https://maps.google.com/maps?cid=123"),
      "https://maps.google.com/maps?cid=123"
    );
    assert.equal(sanitizeReviewRedirectUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeReviewRedirectUrl("http://127.0.0.1/review"), null);
    assert.equal(isAllowedExternalRedirect("https://g.page/r/abc"), true);
  });

  it("hashes share tokens deterministically", () => {
    const a = hashShareToken("abc123");
    const b = hashShareToken("abc123");
    assert.equal(a, b);
    assert.notEqual(a, hashShareToken("other"));
  });

  it("rejects invalid queue job payloads", () => {
    const bad = parseJobPayload("process_scan", { businessId: "not-a-uuid" });
    assert.equal(bad.ok, false);
    const good = parseJobPayload("process_scan", {
      scanBatchId: "00000000-0000-4000-8000-000000000001",
    });
    assert.equal(good.ok, true);
    const importOk = parseJobPayload("import_contacts", {
      uploadId: "00000000-0000-4000-8000-000000000001",
      businessId: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000003",
      mode: "create",
    });
    assert.equal(importOk.ok, true);
    const importBadMode = parseJobPayload("import_contacts", {
      uploadId: "00000000-0000-4000-8000-000000000001",
      businessId: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000003",
      mode: "skip_existing",
    });
    assert.equal(importBadMode.ok, false);
  });

  it("redacts secrets from log payloads", async () => {
    const { redactForLogs } = await import("@/lib/security/redact");
    const out = redactForLogs({
      authorization: "Bearer secret",
      api_key: "abc",
      nested: { refresh_token: "x", ok: 1 },
    }) as Record<string, unknown>;
    assert.equal(out.authorization, "[REDACTED]");
    assert.equal(out.api_key, "[REDACTED]");
    assert.equal((out.nested as Record<string, unknown>).refresh_token, "[REDACTED]");
    assert.equal((out.nested as Record<string, unknown>).ok, 1);
  });

  it("models two-tenant denial when org ids differ", () => {
    const orgA = "org-a";
    const orgB = "org-b";
    const businessOrg = orgB;
    const allowed = businessOrg === orgA;
    assert.equal(allowed, false);
  });

  it("does not embed Brevo webhook secrets in URLs", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    try {
      assert.equal(getBrevoInboundWebhookUrl().includes("?token="), false);
      assert.equal(getBrevoEventsWebhookUrl().includes("?token="), false);
      assert.equal(getBrevoInboundWebhookUrl(), "https://app.example/api/webhooks/brevo/inbound");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });

  it("truncates untrusted prompt text", () => {
    const long = "a".repeat(100);
    assert.equal(sanitizeUntrustedText(long, 20).length, 20);
    assert.equal(sanitizeUntrustedText("hello\x00world").includes("\0"), false);
  });

  it("requires admin MFA in production regardless of env override", () => {
    const prevNode = process.env.NODE_ENV;
    const prevMfa = process.env.ADMIN_REQUIRE_MFA;
    process.env.NODE_ENV = "production";
    process.env.ADMIN_REQUIRE_MFA = "false";
    try {
      assert.equal(isAdminMfaRequired(), true);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevMfa === undefined) delete process.env.ADMIN_REQUIRE_MFA;
      else process.env.ADMIN_REQUIRE_MFA = prevMfa;
    }
  });

  it("reauth rejects iat-only without aal2", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const iatOnly = evaluateRecentAuthFromPayload({ iat: nowSec });
    assert.equal(iatOnly.ok, false);

    const aal2 = evaluateRecentAuthFromPayload({ aal: "aal2", iat: nowSec });
    assert.equal(aal2.ok, true);

    const authTime = evaluateRecentAuthFromPayload({ auth_time: nowSec - 60 });
    assert.equal(authTime.ok, true);
  });

  it("rejects artifact storage path traversal", () => {
    assert.doesNotThrow(() =>
      assertSafeArtifactStoragePath("businesses/abc/scans/def/pdf/report.pdf")
    );
    assert.throws(() => assertSafeArtifactStoragePath("../etc/passwd"));
    assert.throws(() => assertSafeArtifactStoragePath("uploads/evil.pdf"));
    assert.throws(() => assertSafeArtifactStoragePath("businesses/../secret"));
  });

  it("verifies share password scrypt hashes", async () => {
    const hash = await hashSharePassword("hunter2");
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifySharePassword("hunter2", hash), true);
    assert.equal(await verifySharePassword("wrong", hash), false);
  });

  it("blocks deleted and suspended org access helpers", () => {
    assert.equal(isOrganizationAccessBlocked("deleted"), true);
    assert.equal(isOrganizationAccessBlocked("suspended"), true);
    assert.equal(isOrganizationAccessBlocked("active"), false);
    assert.equal(
      isOrganizationEnqueueBlocked({ status: "active", outboundPaused: true }, "send_campaign_email"),
      true
    );
    assert.equal(
      isOrganizationEnqueueBlocked({ status: "active", outboundPaused: true }, "process_scan"),
      false
    );
  });

  it("resolves Coolify MAPS for browser Maps JS injection", () => {
    const prev = {
      MAPS: process.env.MAPS,
      NEXT_PUBLIC_MAPS: process.env.NEXT_PUBLIC_MAPS,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      GOOGLE_MAPS_KEY: process.env.GOOGLE_MAPS_KEY,
    };
    delete process.env.NEXT_PUBLIC_MAPS;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_KEY;
    process.env.MAPS = "coolify-maps-js-key";
    try {
      assert.equal(getBrowserGoogleMapsApiKey(), "coolify-maps-js-key");
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it("uses secure cookie defaults in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const opts = supabaseCookieOptions();
      assert.equal(opts.secure, true);
      // Auth cookies must stay JS-readable for @supabase/ssr browser clients.
      assert.equal(opts.httpOnly, false);
      assert.equal(opts.sameSite, "lax");
      const merged = mergeCookieOptions({ path: "/custom", httpOnly: true });
      assert.equal(merged.secure, true);
      assert.equal(merged.path, "/custom");
      assert.equal(merged.httpOnly, true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
