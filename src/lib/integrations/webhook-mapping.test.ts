import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFieldMapping, isEnrollEventType } from "./webhook-mapping";

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
});
