import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export type OrganizationGateStatus = {
  status: string;
  outboundPaused: boolean;
};

const OUTBOUND_JOB_TYPES = new Set([
  "send_campaign_email",
  "send_campaign_sms",
  "campaign_send_batch",
  "import_contacts",
]);

export class OrganizationEnqueueError extends Error {
  readonly code: "org_required" | "org_lookup_failed" | "org_blocked";

  constructor(code: OrganizationEnqueueError["code"], message: string) {
    super(message);
    this.name = "OrganizationEnqueueError";
    this.code = code;
  }
}

export function isOrganizationAccessBlocked(status: string | null | undefined): boolean {
  const normalized = String(status ?? "active").toLowerCase();
  return normalized === "deleted" || normalized === "suspended";
}

export function isOutboundJobType(jobType: string | null | undefined): boolean {
  if (!jobType) return false;
  return OUTBOUND_JOB_TYPES.has(jobType);
}

export function isOrganizationEnqueueBlocked(
  org: OrganizationGateStatus,
  jobType?: string | null
): boolean {
  if (isOrganizationAccessBlocked(org.status)) return true;
  if (org.outboundPaused && isOutboundJobType(jobType)) return true;
  return false;
}

/**
 * Load org kill-switch / status for enqueue gates.
 * Tolerates missing `outbound_paused` when migration 057 is not applied yet —
 * previously that PostgREST error was treated as "org not found" and every
 * module Run button returned HTTP 404.
 */
export async function loadOrganizationGateStatus(
  organizationId: string
): Promise<OrganizationGateStatus | null> {
  const supabase = createServiceClient();
  const primary = await supabase
    .from("organizations")
    .select("status, outbound_paused")
    .eq("id", organizationId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    return {
      status: String(primary.data.status ?? "active"),
      outboundPaused: Boolean(primary.data.outbound_paused),
    };
  }

  // Column missing / schema lag: fall back to status-only.
  if (primary.error) {
    logger.warn("org_gate_status_select_failed", {
      organizationId,
      error: primary.error.message,
      code: primary.error.code,
    });
    const fallback = await supabase
      .from("organizations")
      .select("status")
      .eq("id", organizationId)
      .maybeSingle();
    if (!fallback.error && fallback.data) {
      return {
        status: String(fallback.data.status ?? "active"),
        outboundPaused: false,
      };
    }
    if (fallback.error) {
      logger.warn("org_gate_status_fallback_failed", {
        organizationId,
        error: fallback.error.message,
        code: fallback.error.code,
      });
    }
    return null;
  }

  return null;
}

export async function assertOrganizationCanEnqueue(
  organizationId: string | null | undefined,
  jobType?: string | null
): Promise<void> {
  if (!organizationId) {
    // Fail closed for outbound / tenant-sensitive enqueue paths.
    if (isOutboundJobType(jobType)) {
      throw new OrganizationEnqueueError("org_required", "Organization required");
    }
    return;
  }
  const org = await loadOrganizationGateStatus(organizationId);
  if (!org) {
    // Do NOT use the words "not found" — httpErrorFromException maps that to
    // a blank-looking HTTP 404 on every module Run button.
    throw new OrganizationEnqueueError(
      "org_lookup_failed",
      "Could not verify organization status for job queue. Apply pending DB migrations (organizations.outbound_paused) and retry."
    );
  }
  if (isOrganizationEnqueueBlocked(org, jobType)) {
    throw new OrganizationEnqueueError(
      "org_blocked",
      "Organization access denied"
    );
  }
}
