import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignMessageFlow,
  canPurchaseNumber,
  isLiveMessagingReady,
} from "./twilio-onboarding";
import { createEmptyRegistration } from "./store";

describe("twilio onboarding readiness", () => {
  it("builds a message flow with consent and policy URLs", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Acme",
    });
    reg.business.legalBusinessName = "Acme LLC";
    reg.useCase.optInMethod = "web form at checkout";
    reg.useCase.privacyPolicyUrl = "https://acme.example/privacy";
    reg.useCase.termsUrl = "https://acme.example/terms";
    const flow = buildCampaignMessageFlow(reg);
    assert.ok(flow.length >= 40);
    assert.match(flow, /Acme LLC/);
    assert.match(flow, /privacy/i);
    assert.match(flow, /STOP/);
  });

  it("gates number purchase until brand or campaign progress", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Acme",
    });
    assert.equal(canPurchaseNumber(reg), false);
    reg.twilio.brandStatus = "APPROVED";
    assert.equal(canPurchaseNumber(reg), true);
  });

  it("requires full ISV chain before SMS ready", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Acme",
    });
    reg.twilio.customerProfileStatus = "twilio-approved";
    reg.twilio.a2pTrustProductStatus = "twilio-approved";
    reg.twilio.brandStatus = "APPROVED";
    reg.twilio.campaignStatus = "VERIFIED";
    reg.twilio.messagingServiceSid = "MGtest";
    reg.twilio.phoneNumberSid = "PNtest";
    assert.equal(isLiveMessagingReady(reg), true);
    reg.messagingPaused = true;
    assert.equal(isLiveMessagingReady(reg), false);
  });
});
