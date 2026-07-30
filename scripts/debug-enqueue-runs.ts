/**
 * Diagnose job_queue enqueue failures — run against prod or local Supabase.
 *
 * Usage (Coolify shell or local with .env):
 *   npx tsx scripts/debug-enqueue-runs.ts
 *   AUDIT_BUSINESS_ID=<uuid> npx tsx scripts/debug-enqueue-runs.ts
 *
 * Prints the real Postgres / RPC error for each module Run path.
 */
import { randomUUID } from "crypto";
import { createServiceClient } from "../src/lib/db/client";
import { assertOrganizationCanEnqueue } from "../src/lib/auth/org-status";
import { dispatchFeatureJob } from "../src/lib/queue/dispatch";
import { createLedgerJob } from "../src/lib/queue/ledger";
import { jobTypeToQueue } from "../src/lib/queue/job-handlers";
import { reserveUsageOrThrow } from "../src/lib/plans";

const BUSINESS_ID =
  process.env.AUDIT_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";

async function getOrgIdForBusiness(businessId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(`business lookup: ${error.message}`);
  return (data?.organization_id as string) ?? null;
}

async function probeRawInsert(organizationId: string, businessId: string) {
  const supabase = createServiceClient();
  const row = {
    id: randomUUID(),
    job_type: "growth_audit_run",
    payload: { businessId, organizationId, probe: true },
    status: "pending",
    organization_id: organizationId,
    business_id: businessId,
    queue_name: "maintenance",
    priority: 50,
    idempotency_key: `debug-probe:${randomUUID()}`,
    max_attempts: 2,
    scheduled_at: new Date().toISOString(),
    enqueue_state: "pending",
    lifecycle_status: "pending_enqueue",
    progress_json: {},
    progress_completed: 0,
    progress_failed: 0,
  };
  const { data, error } = await supabase.from("job_queue").insert(row).select("id").single();
  if (error) {
    console.error("RAW INSERT FAILED:", error.message);
    console.error("  code:", error.code, "details:", error.details, "hint:", error.hint);
    return false;
  }
  console.log("RAW INSERT OK — id:", data?.id);
  if (data?.id) {
    await supabase.from("job_queue").delete().eq("id", data.id);
    console.log("  (probe row deleted)");
  }
  return true;
}

async function probeLedgerCreate(organizationId: string, businessId: string) {
  try {
    const rec = await createLedgerJob({
      queueName: jobTypeToQueue("growth_audit_run"),
      jobType: "growth_audit_run",
      payload: { businessId, organizationId, probe: true },
      organizationId,
      businessId,
      idempotencyKey: `debug-ledger:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
    });
    console.log("createLedgerJob OK — id:", rec.id);
    const supabase = createServiceClient();
    await supabase.from("job_queue").delete().eq("id", rec.id);
    console.log("  (probe row deleted)");
    return true;
  } catch (e) {
    console.error("createLedgerJob FAILED:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function probeDispatch(
  label: string,
  fn: () => Promise<unknown>
): Promise<void> {
  process.stdout.write(`\n=== ${label} ===\n`);
  try {
    const result = await fn();
    console.log("OK:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("FAILED:", e instanceof Error ? e.message : String(e));
    if (e && typeof e === "object" && "code" in e) {
      console.error("  code:", (e as { code?: string }).code);
    }
  }
}

async function main() {
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)");
  console.log("Business:", BUSINESS_ID);
  console.log("QUEUE_DRIVER:", process.env.QUEUE_DRIVER ?? "database (default)");

  const organizationId = await getOrgIdForBusiness(BUSINESS_ID);
  if (!organizationId) {
    console.error("Business not found in DB");
    process.exit(1);
  }
  console.log("Organization:", organizationId);

  console.log("\n=== org enqueue gate ===");
  try {
    await assertOrganizationCanEnqueue(organizationId, "growth_audit_run");
    console.log("assertOrganizationCanEnqueue OK");
  } catch (e) {
    console.error("assertOrganizationCanEnqueue FAILED:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== raw job_queue insert ===");
  await probeRawInsert(organizationId, BUSINESS_ID);

  console.log("\n=== createLedgerJob ===");
  await probeLedgerCreate(organizationId, BUSINESS_ID);

  await probeDispatch("reserveUsage growth_audits_used", async () => {
    const used = await reserveUsageOrThrow(organizationId, "growth_audits_used", 1);
    console.log("  used after reserve:", used);
    return { used };
  });

  await probeDispatch("dispatchFeatureJob growth_audit_run", async () => {
    return dispatchFeatureJob({
      jobType: "growth_audit_run",
      payload: {
        businessId: BUSINESS_ID,
        organizationId,
        skipBackground: true,
      },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-growth:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  await probeDispatch("dispatchFeatureJob keyword_check", async () => {
    return dispatchFeatureJob({
      jobType: "keyword_check",
      payload: { businessId: BUSINESS_ID, organizationId },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-kw:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  await probeDispatch("dispatchFeatureJob backlink_gap_run", async () => {
    return dispatchFeatureJob({
      jobType: "backlink_gap_run",
      payload: { businessId: BUSINESS_ID, organizationId },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-bd:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  await probeDispatch("dispatchFeatureJob local_trust_run", async () => {
    return dispatchFeatureJob({
      jobType: "local_trust_run",
      payload: { businessId: BUSINESS_ID, organizationId },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-trust:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  await probeDispatch("dispatchFeatureJob ai_visibility_run", async () => {
    return dispatchFeatureJob({
      jobType: "ai_visibility_run",
      payload: { businessId: BUSINESS_ID, organizationId },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-ai:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  await probeDispatch("dispatchFeatureJob reputation_audit", async () => {
    return dispatchFeatureJob({
      jobType: "reputation_audit",
      payload: { businessId: BUSINESS_ID, organizationId },
      organizationId,
      businessId: BUSINESS_ID,
      idempotencyKey: `debug-rep:${randomUUID()}`,
      priority: "normal",
      maxAttempts: 2,
      kickImmediately: false,
    });
  });

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
