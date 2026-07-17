import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateSameOriginMutation,
  getAllowedOrigins,
  MODULE_RUN_ENDPOINTS,
} from "@/lib/security/csrf";

const LIVE_ORIGIN = "https://app.localseoexpress.com";
const LEGACY_ORIGIN = "https://app.localexpress.com";
const EVIL_ORIGIN = "https://evil.example";

function mutateRequest(
  path: string,
  headers: Record<string, string | null>
): ReturnType<typeof evaluateSameOriginMutation> {
  return evaluateSameOriginMutation({
    method: "POST",
    url: `http://localhost:3000${path}`,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
  });
}

describe("module Run button CSRF", () => {
  for (const path of MODULE_RUN_ENDPOINTS) {
    it(`allows live production origin for ${path}`, () => {
      const prev = {
        app: process.env.APP_URL,
        public: process.env.NEXT_PUBLIC_APP_URL,
        allowed: process.env.ALLOWED_ORIGINS,
        node: process.env.NODE_ENV,
      };
      process.env.APP_URL = LIVE_ORIGIN;
      process.env.NEXT_PUBLIC_APP_URL = LIVE_ORIGIN;
      process.env.ALLOWED_ORIGINS = LIVE_ORIGIN;
      process.env.NODE_ENV = "production";
      try {
        const decision = mutateRequest(path, {
          origin: LIVE_ORIGIN,
          cookie: "sb-access-token=test",
        });
        assert.equal(decision.ok, true, decision.diagnostics.reason ?? "ok");
      } finally {
        if (prev.app === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = prev.app;
        if (prev.public === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = prev.public;
        if (prev.allowed === undefined) delete process.env.ALLOWED_ORIGINS;
        else process.env.ALLOWED_ORIGINS = prev.allowed;
        process.env.NODE_ENV = prev.node;
      }
    });

    it(`allows live origin when APP_URL is legacy typo for ${path}`, () => {
      const prev = {
        app: process.env.APP_URL,
        public: process.env.NEXT_PUBLIC_APP_URL,
        allowed: process.env.ALLOWED_ORIGINS,
        node: process.env.NODE_ENV,
      };
      process.env.APP_URL = LEGACY_ORIGIN;
      process.env.NEXT_PUBLIC_APP_URL = LEGACY_ORIGIN;
      delete process.env.ALLOWED_ORIGINS;
      process.env.NODE_ENV = "production";
      try {
        assert.ok(getAllowedOrigins().includes(LIVE_ORIGIN));
        const decision = mutateRequest(path, {
          origin: LIVE_ORIGIN,
          cookie: "sb-access-token=test",
        });
        assert.equal(decision.ok, true, decision.diagnostics.reason ?? "ok");
      } finally {
        if (prev.app === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = prev.app;
        if (prev.public === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = prev.public;
        if (prev.allowed === undefined) delete process.env.ALLOWED_ORIGINS;
        else process.env.ALLOWED_ORIGINS = prev.allowed;
        process.env.NODE_ENV = prev.node;
      }
    });

    it(`rejects evil origin for ${path}`, () => {
      const prev = {
        app: process.env.APP_URL,
        node: process.env.NODE_ENV,
      };
      process.env.APP_URL = LIVE_ORIGIN;
      process.env.NODE_ENV = "production";
      try {
        const decision = mutateRequest(path, { origin: EVIL_ORIGIN });
        assert.equal(decision.ok, false);
        assert.equal(decision.diagnostics.reason, "origin_not_allowlisted");
      } finally {
        if (prev.app === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = prev.app;
        process.env.NODE_ENV = prev.node;
      }
    });

    it(`rejects cookie without origin for ${path}`, () => {
      const prev = {
        app: process.env.APP_URL,
        node: process.env.NODE_ENV,
      };
      process.env.APP_URL = LIVE_ORIGIN;
      process.env.NODE_ENV = "production";
      try {
        const decision = mutateRequest(path, { cookie: "sb-access-token=test" });
        assert.equal(decision.ok, false);
        assert.equal(decision.diagnostics.reason, "cookie_without_origin");
      } finally {
        if (prev.app === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = prev.app;
        process.env.NODE_ENV = prev.node;
      }
    });
  }
});
