import assert from "node:assert/strict";
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
});
