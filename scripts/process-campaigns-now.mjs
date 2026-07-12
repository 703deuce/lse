import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.replace(/\r$/, "").match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const { campaignImmediateSendEnabled } = await import("../src/lib/reputation/campaign-scheduler.ts");
const { processCampaignMessages } = await import("../src/lib/reputation/campaign-processor.ts");
const { createServiceClient } = await import("../src/lib/db/client.ts");

console.log("REVIEW_CAMPAIGN_IMMEDIATE_SEND:", process.env.REVIEW_CAMPAIGN_IMMEDIATE_SEND);
console.log("immediate enabled:", campaignImmediateSendEnabled());

const sent = await processCampaignMessages(20);
console.log("messages sent this run:", sent);

const supabase = createServiceClient();
const { data: msgs } = await supabase
  .from("review_request_messages")
  .select("channel, status, failed_reason, recipient_id")
  .order("created_at", { ascending: false })
  .limit(10);

const { data: recs } = await supabase
  .from("review_request_recipients")
  .select("id, first_name, phone, email")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("recent recipients:", recs);
console.log("recent messages:", msgs);
