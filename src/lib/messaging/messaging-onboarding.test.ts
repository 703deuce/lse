import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockReconcileStatus, mockSearchNumbers, mockSubmitRegistration } from "./mock-adapter";
import { createEmptyRegistration } from "./store";
import {
  buildProgressSteps,
  buildRegistrationTimeline,
  isMessagingReady,
  isStepAvailable,
  nextSetupHref,
  registrationCompletionPercent,
} from "./status";

describe("messaging onboarding", () => {
  it("builds six progress steps with availability locks", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    const steps = buildProgressSteps(reg, "biz");
    assert.equal(steps.length, 6);
    assert.equal(steps[0]?.id, "business_details");
    assert.equal(steps[0]?.available, true);
    assert.equal(steps[1]?.available, false);
    assert.equal(steps[5]?.id, "ready_to_text");
    assert.equal(registrationCompletionPercent(reg), 0);
  });

  it("unlocks later steps after business details start", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    reg.businessDetailsStatus = "submitted";
    assert.equal(isStepAvailable(reg, "messaging_use_case"), true);
    assert.equal(isStepAvailable(reg, "choose_number"), false);
  });

  it("mock submit moves registration into review", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    reg.businessDetailsStatus = "submitted";
    reg.useCaseStatus = "submitted";
    reg.business.certAuthorized = true;
    reg.business.certAccurate = true;
    reg.business.certUnderstandsDelays = true;
    const result = mockSubmitRegistration(reg);
    assert.equal(result.registration.overallStatus, "in_review");
    assert.ok(result.registration.twilio.subaccountSid);
    assert.ok(result.registration.twilio.customerProfileSid);
  });

  it("mock reconcile can approve brand then campaign", () => {
    let reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    reg = mockSubmitRegistration(reg).registration;
    reg = mockReconcileStatus(reg).registration;
    assert.equal(reg.businessDetailsStatus, "approved");
    reg = mockReconcileStatus(reg).registration;
    assert.equal(reg.brandVerificationStatus, "approved");
    assert.equal(reg.campaignReviewStatus, "in_review");
    reg = mockReconcileStatus(reg).registration;
    assert.equal(reg.campaignReviewStatus, "approved");
  });

  it("searches mock numbers by area code, ZIP, and vanity digits", () => {
    const rows = mockSearchNumbers({ areaCode: "571" });
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((row) => row.phoneNumber.includes("571")));
    const zipRows = mockSearchNumbers({ postalCode: "22191" });
    assert.ok(zipRows.every((row) => row.locality === "Woodbridge"));
    const vanity = mockSearchNumbers({ contains: "0108" });
    assert.equal(vanity.length, 1);
    assert.equal(vanity[0]?.friendlyName, "(571) 555-0108");
  });

  it("builds a plain-language registration timeline", () => {
    let reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    reg.businessDetailsStatus = "submitted";
    reg.useCaseStatus = "submitted";
    reg.business.certAuthorized = true;
    reg.business.certAccurate = true;
    reg.business.certUnderstandsDelays = true;
    reg = mockSubmitRegistration(reg).registration;
    const timeline = buildRegistrationTimeline(reg);
    assert.ok(timeline.some((item) => item.state === "current" || item.state === "complete"));
    assert.ok(timeline.find((item) => item.id === "awaiting_review"));
  });

  it("routes next setup href sensibly", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Long Home",
    });
    assert.equal(nextSetupHref(reg, "biz"), "/businesses/biz/reputation/messaging/business");
    assert.equal(isMessagingReady(reg), false);
  });
});
