import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapTwilioBusinessIndustry,
  mapTwilioBusinessType,
  mapTwilioJobPosition,
  normalizeEin,
  splitAuthRepName,
  toTrustHubBusinessAttributes,
} from "./twilio-mappings";
import { mapTwilioStatus, profileStatusLabel } from "./status";
import { EMPTY_BUSINESS_FORM } from "./types";

describe("twilio mappings", () => {
  it("maps friendly business types to Twilio enumerations", () => {
    assert.equal(mapTwilioBusinessType("LLC"), "Limited Liability Corporation");
    assert.equal(mapTwilioBusinessType("Corporation"), "Corporation");
    assert.equal(mapTwilioBusinessType("Sole Proprietorship"), "Sole Proprietorship");
    assert.equal(mapTwilioBusinessType("Non-profit"), "Non-profit Corporation");
  });

  it("maps industries and preserves Twilio SCREAMING_SNAKE values", () => {
    assert.equal(mapTwilioBusinessIndustry("Home Services"), "PROFESSIONAL_SERVICES");
    assert.equal(mapTwilioBusinessIndustry("HEALTHCARE"), "HEALTHCARE");
    assert.equal(mapTwilioBusinessIndustry("real estate"), "REAL_ESTATE");
  });

  it("maps authorized-rep titles to job_position enums", () => {
    assert.equal(mapTwilioJobPosition("Chief Executive Officer", ""), "CEO");
    assert.equal(mapTwilioJobPosition("VP of Ops", ""), "VP");
    assert.equal(mapTwilioJobPosition("Owner", "Authorized representative"), "Other");
  });

  it("normalizes EIN and splits names", () => {
    assert.equal(normalizeEin("12-3456789"), "123456789");
    assert.deepEqual(splitAuthRepName("Alex Morgan"), {
      firstName: "Alex",
      lastName: "Morgan",
    });
  });

  it("builds TrustHub business attributes for secondary profiles", () => {
    const attrs = toTrustHubBusinessAttributes({
      ...EMPTY_BUSINESS_FORM,
      legalBusinessName: "Acme LLC",
      businessType: "LLC",
      businessIndustry: "Home Services",
      ein: "12-3456789",
      websiteUrl: "https://acme.example",
      regionsOfOperation: ["VA"],
    });
    assert.equal(attrs.business_identity, "direct_customer");
    assert.equal(attrs.business_type, "Limited Liability Corporation");
    assert.equal(attrs.business_industry, "PROFESSIONAL_SERVICES");
    assert.equal(attrs.business_registration_number, "123456789");
    assert.equal(attrs.business_regions_of_operation, "USA_AND_CANADA");
  });

  it("maps TrustHub profile statuses for the customer UI", () => {
    assert.equal(mapTwilioStatus("draft"), "not_started");
    assert.equal(mapTwilioStatus("pending-review"), "in_review");
    assert.equal(mapTwilioStatus("twilio-approved"), "approved");
    assert.equal(mapTwilioStatus("twilio-rejected"), "action_required");
    assert.equal(profileStatusLabel("draft"), "Not submitted");
    assert.equal(profileStatusLabel("pending-review"), "In review");
    assert.equal(profileStatusLabel("twilio-approved"), "Approved");
    assert.equal(profileStatusLabel("twilio-rejected"), "Action required");
  });
});
