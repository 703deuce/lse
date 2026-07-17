import { createServiceClient } from "@/lib/db/client";

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

export async function loadOrganizationGateStatus(
  organizationId: string
): Promise<OrganizationGateStatus | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organizations")
    .select("status, outbound_paused")
    .eq("id", organizationId)
    .maybeSingle();
  if (!data) return null;
  return {
    status: String(data.status ?? "active"),
    outboundPaused: Boolean(data.outbound_paused),
  };
}

export async function assertOrganizationCanEnqueue(
  organizationId: string | null | undefined,
  jobType?: string | null
): Promise<void> {
  if (!organizationId) {
    // Fail closed for outbound / tenant-sensitive enqueue paths.
    if (isOutboundJobType(jobType)) {
      throw new Error("Organization required");
    }
    return;
  }
  const org = await loadOrganizationGateStatus(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }
  if (isOrganizationEnqueueBlocked(org, jobType)) {
    throw new Error("Organization access denied");
  }
}
