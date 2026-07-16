import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";

/**
 * Guards for platform completion audit close-out (offline, no Redis/DB).
 */
describe("platform completion audit invariants", () => {
  it("routes generate_report and send_notification onto dedicated queues", () => {
    assert.equal(jobTypeToQueue("generate_report"), "report-generation");
    assert.equal(jobTypeToQueue("send_notification"), "notifications");
    assert.equal(jobTypeToQueue("send_campaign_email"), "email-send");
    assert.equal(jobTypeToQueue("send_campaign_sms"), "sms-send");
    assert.equal(jobTypeToQueue("process_scan"), "maps-scan");
  });

  it("treats completed/failed/canceled as terminal for frontend pollers", () => {
    assert.equal(isTerminalJobStatus("completed"), true);
    assert.equal(isTerminalJobStatus("failed"), true);
    assert.equal(isTerminalJobStatus("canceled"), true);
    assert.equal(isTerminalJobStatus("cancelled"), true);
    assert.equal(isTerminalJobStatus("running"), false);
    assert.equal(isTerminalJobStatus("queued"), false);
  });

  it("keeps messaging send types off maps-scan queue", () => {
    for (const t of [
      "send_campaign_email",
      "send_campaign_sms",
      "send_notification",
      "campaign_send_batch",
      "import_contacts",
    ] as const) {
      assert.notEqual(jobTypeToQueue(t), "maps-scan");
    }
  });
});
