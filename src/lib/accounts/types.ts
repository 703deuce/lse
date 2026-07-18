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
