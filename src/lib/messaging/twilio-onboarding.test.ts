import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignMessageFlow,
  canPurchaseNumber,
  isLiveMessagingReady,
  shouldAutoReleaseUnusedNumber,
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

  it("allows number purchase once a subaccount exists (or mock mode)", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Acme",
    });
    reg.adapterMode = "twilio";
    reg.twilio.subaccountSid = null;
    assert.equal(canPurchaseNumber(reg), false);
    reg.adapterMode = "mock";
    assert.equal(canPurchaseNumber(reg), true);
    reg.adapterMode = "twilio";
    reg.twilio.subaccountSid = "ACtest";
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
    reg.twilio.phoneNumberAttached = true;
    assert.equal(isLiveMessagingReady(reg), true);
    reg.messagingPaused = true;
    assert.equal(isLiveMessagingReady(reg), false);
  });

  it("auto-releases abandoned purchased numbers after grace, not in-review ones", () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz",
      businessName: "Acme",
    });
    reg.twilio.phoneNumberSid = "PNtest";
    reg.phoneNumberPurchasedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(shouldAutoReleaseUnusedNumber(reg), true);

    reg.submittedAt = new Date().toISOString();
    assert.equal(shouldAutoReleaseUnusedNumber(reg), false);

    reg.submittedAt = null;
    reg.twilio.profileSubmittedAt = new Date().toISOString();
    assert.equal(shouldAutoReleaseUnusedNumber(reg), false);
  });
});
