import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  OrganizationEnqueueError,
  assertOrganizationCanEnqueue,
  isOrganizationEnqueueBlocked,
  isOutboundJobType,
} from "@/lib/auth/org-status";
import { httpErrorFromException } from "@/lib/security/http-errors";

describe("organization enqueue gate", () => {
  it("only treats messaging jobs as outbound", () => {
    assert.equal(isOutboundJobType("send_campaign_email"), true);
    assert.equal(isOutboundJobType("backlink_gap_run"), false);
    assert.equal(isOutboundJobType("review_momentum_run"), false);
  });

  it("does not block analysis jobs when outbound is paused", () => {
    assert.equal(
      isOrganizationEnqueueBlocked(
        { status: "active", outboundPaused: true },
        "backlink_gap_run"
      ),
      false
    );
    assert.equal(
      isOrganizationEnqueueBlocked(
        { status: "active", outboundPaused: true },
        "send_campaign_sms"
      ),
      true
    );
  });

  it("maps org lookup failures to 503, not 404", () => {
    const err = new OrganizationEnqueueError(
      "org_lookup_failed",
      "Could not verify organization status for job queue."
    );
    const res = httpErrorFromException(err, "Run failed");
    assert.equal(res.status, 503);
  });

  it("does not map Organization not found strings to blank 404", () => {
    const res = httpErrorFromException(
      new Error("Organization not found"),
      "Backlink gap analysis failed"
    );
    // Must not be the old misleading 404 that broke every Run button.
    assert.notEqual(res.status, 404);
  });

  it("allows enqueue when organizationId is missing for non-outbound jobs", async () => {
    await assert.doesNotReject(() =>
      assertOrganizationCanEnqueue(null, "review_momentum_run")
    );
  });

  it("requires organizationId for outbound jobs", async () => {
    await assert.rejects(
      () => assertOrganizationCanEnqueue(null, "send_campaign_email"),
      (err: unknown) =>
        err instanceof OrganizationEnqueueError && err.code === "org_required"
    );
  });

  it("keeps org kill-switch out of session auth (pre-ASVS model)", () => {
    // Regression: 60c882d/b77273a wired loadOrganizationGateStatus into
    // getAuthContext and signed users out on lookup miss — modules died,
    // workers kept going. Reports "worked" after a different fix (reauth /
    // downloads). Session auth must stay user + membership only.
    const contextSrc = readFileSync(
      join(process.cwd(), "src/lib/auth/context.ts"),
      "utf8"
    );
    // Strip block/line comments so docstrings may name the forbidden API.
    const codeOnly = contextSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.match(codeOnly, /getOrganizationIdForUser/);
    assert.doesNotMatch(
      codeOnly,
      /loadOrganizationGateStatus/,
      "getAuthContext must not call loadOrganizationGateStatus"
    );
    assert.doesNotMatch(
      codeOnly,
      /\.signOut\s*\(/,
      "getAuthContext must not sign users out"
    );
  });
});
