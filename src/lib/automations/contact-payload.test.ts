import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactDisplayName, parseAutomationContact } from "./contact-payload";

describe("parseAutomationContact", () => {
  it("reads nested contact objects", () => {
    const c = parseAutomationContact({
      contact: { firstName: "Ada", lastName: "Lovelace", phone: "+15551112222" },
    });
    assert.equal(c.firstName, "Ada");
    assert.equal(c.phone, "+15551112222");
    assert.equal(contactDisplayName(c), "Ada Lovelace");
  });

  it("reads Zapier-style flat fields", () => {
    const c = parseAutomationContact({
      customer_name: "Jamie Lee",
      customer_phone: "555-111-2222",
      customer_email: "jamie@example.com",
      job_type: "Plumbing",
      external_id: "job-9",
    });
    assert.equal(c.name, "Jamie Lee");
    assert.equal(c.phone, "555-111-2222");
    assert.equal(c.email, "jamie@example.com");
    assert.equal(c.jobType, "Plumbing");
    assert.equal(c.externalId, "job-9");
  });
});
