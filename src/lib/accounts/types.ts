export type AccountType = "prospect" | "client";

export type ProspectStatus =
  | "new"
  | "contacted"
  | "audit_sent"
  | "proposal_sent"
  | "won"
  | "lost"
  | "archived";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "new",
  "contacted",
  "audit_sent",
  "proposal_sent",
  "won",
  "lost",
  "archived",
];

export const PROSPECT_PIPELINE_STATUSES = [
  "new",
  "contacted",
  "audit_sent",
  "proposal_sent",
  "won",
  "lost",
] as const satisfies readonly ProspectStatus[];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  audit_sent: "Audit sent",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

export type ProspectPipelineStatus = (typeof PROSPECT_PIPELINE_STATUSES)[number];

export function prospectPipelineStatus(
  status: ProspectStatus | string | null | undefined
): ProspectPipelineStatus {
  return PROSPECT_PIPELINE_STATUSES.includes(status as ProspectPipelineStatus)
    ? (status as ProspectPipelineStatus)
    : "new";
}

export type AccountListRow = {
  id: string;
  name: string;
  address_text?: string | null;
  scan_center_label?: string | null;
  primary_category?: string | null;
  is_tracked?: boolean | null;
  account_type?: AccountType | null;
  prospect_status?: ProspectStatus | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
};

export function isProspectRow(b: AccountListRow): boolean {
  if (b.archived_at) return false;
  if (b.account_type === "prospect") return true;
  if (b.account_type === "client") return false;
  // Pre-migration fallback
  return b.is_tracked === false;
}

export function isClientRow(b: AccountListRow): boolean {
  if (b.archived_at) return false;
  if (b.account_type === "client") return true;
  if (b.account_type === "prospect") return false;
  return b.is_tracked !== false;
}
