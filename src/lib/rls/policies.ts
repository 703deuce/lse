/**
 * RLS policy reference — tighten when Firebase auth lands.
 * Pattern: organization_id on business tables + membership check on auth.uid().
 *
 * Example (future):
 * CREATE POLICY "org_members_read_businesses" ON businesses FOR SELECT
 * USING (organization_id IN (
 *   SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
 * ));
 */

export const RLS_NOTES = {
  currentMode: "service_role_bypass",
  tablesWithRls: [
    "organizations",
    "organization_members",
    "businesses",
    "business_keywords",
    "scan_batches",
    "scan_points",
    "scan_results",
    "audits",
    "audit_findings",
    "action_plans",
    "action_items",
    "provider_runs",
    "reports",
    "integrations_google",
    "competitors",
    "job_queue",
    "profiles",
    "scan_provider_tasks",
    "scheduled_scans",
  ],
} as const;
