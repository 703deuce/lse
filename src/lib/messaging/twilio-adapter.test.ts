import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCustomerSubaccount } from "./twilio-adapter";
import { createEmptyRegistration } from "./store";

describe("twilio adapter idempotency", () => {
  it("reuses an existing subaccount sid without calling Twilio", async () => {
    const reg = createEmptyRegistration({
      organizationId: "org",
      businessId: "biz-idempotent",
      businessName: "Acme",
    });
    reg.twilio.subaccountSid = "ACalreadyexists000000000000000001";
    reg.twilio.subaccountStatus = "active";

    const result = await createCustomerSubaccount(reg);
    assert.equal(result.registration.twilio.subaccountSid, "ACalreadyexists000000000000000001");
    assert.equal(result.events[0]?.eventType, "subaccount_reused");
  });
});
