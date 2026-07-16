import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyFieldMapping,
  detectFieldMapping,
  isEnrollEventType,
} from "./webhook-mapping";

describe("webhook field mapping", () => {
  it("reads canonical payload", () => {
    const n = applyFieldMapping(
      {
        event_id: "job_1",
        event_type: "service.completed",
        customer: { first_name: "Ann", email: "ann@example.com", phone: "+1555" },
      },
      {}
    );
    assert.equal(n.event_id, "job_1");
    assert.equal(n.customer.email, "ann@example.com");
    assert.equal(isEnrollEventType(n.event_type), true);
  });

  it("maps Zapier flat / nested paths", () => {
    const n = applyFieldMapping(
      {
        data: { client: { email: "x@y.com", phone: "555" } },
        job: { id: "j9" },
      },
      {
        email: "data.client.email",
        phone: "data.client.phone",
        event_id: "job.id",
        event_type: undefined,
      },
      { eventType: "invoice.paid" }
    );
    assert.equal(n.customer.email, "x@y.com");
    assert.equal(n.event_id, "j9");
    assert.equal(n.event_type, "invoice.paid");
  });

  it("auto-detects mapping from sample CRM JSON", () => {
    const mapping = detectFieldMapping({
      data: {
        clientEmail: "pat@example.com",
        clientPhone: "+15405551212",
        clientFirstName: "Pat",
        clientLastName: "Lee",
        customerId: "crm_99",
      },
      jobId: "job_55",
      completedAt: "2026-07-16T12:00:00Z",
    });
    assert.equal(mapping.email, "data.clientEmail");
    assert.equal(mapping.phone, "data.clientPhone");
    assert.equal(mapping.first_name, "data.clientFirstName");
    assert.equal(mapping.last_name, "data.clientLastName");
    assert.equal(mapping.external_customer_id, "data.customerId");
    assert.equal(mapping.event_id, "jobId");

    const n = applyFieldMapping(
      {
        data: {
          clientEmail: "pat@example.com",
          clientPhone: "+15405551212",
          clientFirstName: "Pat",
          clientLastName: "Lee",
          customerId: "crm_99",
        },
        jobId: "job_55",
      },
      mapping,
      { eventType: "service.completed" }
    );
    assert.equal(n.customer.email, "pat@example.com");
    assert.equal(n.customer.external_id, "crm_99");
    assert.equal(n.event_id, "job_55");
  });
});
