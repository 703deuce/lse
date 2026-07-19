import { createServiceClient } from "@/lib/db/client";

export type NextBestAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  kind:
    | "setup"
    | "scan"
    | "campaign"
    | "audit"
    | "report"
    | "prospect"
    | "client"
    | "branding";
};

export type SetupProgress = {
  accountCreated: boolean;
  firstBusinessAdded: boolean;
  firstScanRun: boolean;
  brandingAdded: boolean;
  firstReportCreated: boolean;
  complete: boolean;
  steps: Array<{ id: string; label: string; done: boolean; href: string }>;
};

/**
 * Rule-based next best actions for the freelancer journey.
 * Keep this deterministic and cheap — no ML.
 */
export async function loadOrgSetupProgress(
  organizationId: string
): Promise<SetupProgress> {
  const supabase = createServiceClient();

  const [{ count: businessCount }, { data: org }, { data: bizRows }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("archived_at", null),
      supabase
        .from("organizations")
        .select("report_logo_url, report_footer_text, report_contact_line, name")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("id")
        .eq("organization_id", organizationId)
        .limit(80),
    ]);

  const ids = (bizRows ?? []).map((b) => b.id as string);
  let reports = 0;
  let scans = 0;
  if (ids.length) {
    const [reportRes, scanRes] = await Promise.all([
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("business_id", ids),
      supabase
        .from("scan_batches")
        .select("id", { count: "exact", head: true })
        .in("business_id", ids),
    ]);
    reports = reportRes.count ?? 0;
    scans = scanRes.count ?? 0;
  }

  const brandingAdded = Boolean(
    org?.report_logo_url || org?.report_footer_text || org?.report_contact_line
  );
  const firstBusinessAdded = (businessCount ?? 0) > 0;
  const firstScanRun = scans > 0;
  const firstReportCreated = reports > 0;

  const steps = [
    {
      id: "account",
      label: "Account created",
      done: true,
      href: "/settings",
    },
    {
      id: "business",
      label: "First prospect or client added",
      done: firstBusinessAdded,
      href: "/businesses/new?as=client",
    },
    {
      id: "scan",
      label: "Run first Maps scan",
      done: firstScanRun,
      href: "/scans/new",
    },
    {
      id: "branding",
      label: "Add branding",
      done: brandingAdded,
      href: "/branding",
    },
    {
      id: "report",
      label: "Create first report",
      done: firstReportCreated,
      href: "/reports",
    },
  ];

  return {
    accountCreated: true,
    firstBusinessAdded,
    firstScanRun,
    brandingAdded,
    firstReportCreated,
    complete: steps.every((s) => s.done),
    steps,
  };
}

export async function loadOrgNextBestActions(
  organizationId: string,
  options?: { limit?: number }
): Promise<NextBestAction[]> {
  const supabase = createServiceClient();
  const limit = options?.limit ?? 6;
  const actions: NextBestAction[] = [];
  const setup = await loadOrgSetupProgress(organizationId);

  if (!setup.firstBusinessAdded) {
    actions.push({
      id: "add-first-client",
      title: "Add your first client",
      description: "Set up a location so you can run scans and deliver reports.",
      href: "/businesses/new?as=client",
      priority: 10,
      kind: "setup",
    });
    actions.push({
      id: "add-first-prospect",
      title: "Or audit a prospect",
      description: "Run a Maps audit to win a new local SEO client.",
      href: "/businesses/new?as=prospect",
      priority: 11,
      kind: "prospect",
    });
    return actions.slice(0, limit);
  }

  if (!setup.brandingAdded) {
    actions.push({
      id: "add-branding",
      title: "Add your branding",
      description: "Logo and contact line so reports look like yours.",
      href: "/branding",
      priority: 20,
      kind: "branding",
    });
  }

  // Clients with no scans this month
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: clients } = await supabase
    .from("businesses")
    .select("id, name, account_type, prospect_status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  const clientRows = (clients ?? []).filter(
    (b) => (b.account_type as string) !== "prospect"
  );
  const prospectRows = (clients ?? []).filter(
    (b) => (b.account_type as string) === "prospect"
  );

  for (const client of clientRows.slice(0, 12)) {
    const { count } = await supabase
      .from("scan_batches")
      .select("id", { count: "exact", head: true })
      .eq("business_id", client.id as string)
      .gte("created_at", monthStart.toISOString())
      .in("status", ["ready", "partial", "rank_ready", "running", "queued"]);
    if ((count ?? 0) === 0) {
      actions.push({
        id: `scan-${client.id}`,
        title: `Run a scan for ${client.name}`,
        description: "No Maps scan yet this month — establish or refresh visibility.",
        href: `/businesses/${client.id}/scans`,
        priority: 30,
        kind: "scan",
      });
    }
  }

  // Prospects with audit_sent or later but no published report share nudge
  for (const p of prospectRows.slice(0, 8)) {
    const status = String(p.prospect_status ?? "new");
    if (status === "new" || status === "contacted") {
      actions.push({
        id: `prospect-audit-${p.id}`,
        title: `Run prospect audit for ${p.name}`,
        description: "Baseline Maps scan + Growth Audit → shareable report.",
        href: `/prospects/${p.id}?audit=1`,
        priority: 25,
        kind: "prospect",
      });
    } else if (status === "audit_sent" || status === "proposal_sent") {
      actions.push({
        id: `prospect-convert-${p.id}`,
        title: `Convert ${p.name} to client?`,
        description: "They have an audit — preserve history and start tracking.",
        href: `/prospects/${p.id}?convert=1`,
        priority: 35,
        kind: "client",
      });
    }
  }

  // Draft reports
  const bizIds = (clients ?? []).map((b) => b.id as string);
  if (bizIds.length) {
    const { data: drafts } = await supabase
      .from("reports")
      .select("id, business_id, metadata_json, publish_status")
      .in("business_id", bizIds)
      .eq("publish_status", "draft")
      .order("generated_at", { ascending: false })
      .limit(5);
    for (const d of drafts ?? []) {
      const biz = (clients ?? []).find((b) => b.id === d.business_id);
      actions.push({
        id: `draft-${d.id}`,
        title: `Finish draft report${biz ? ` for ${biz.name}` : ""}`,
        description: "Review the summary and publish the share link.",
        href: `/businesses/${d.business_id}/reports`,
        priority: 28,
        kind: "report",
      });
    }

    // Clients with recent scans but no report this month
    for (const client of clientRows.slice(0, 8)) {
      const [{ count: recentScans }, { count: recentReports }] = await Promise.all([
        supabase
          .from("scan_batches")
          .select("id", { count: "exact", head: true })
          .eq("business_id", client.id as string)
          .gte("created_at", monthStart.toISOString())
          .in("status", ["ready", "partial", "rank_ready"]),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("business_id", client.id as string)
          .gte("generated_at", monthStart.toISOString()),
      ]);
      if ((recentScans ?? 0) > 0 && (recentReports ?? 0) === 0) {
        actions.push({
          id: `monthly-${client.id}`,
          title: `Create monthly report for ${client.name}`,
          description: "Scans are ready — package them into a client deliverable.",
          href: `/businesses/${client.id}/reports?type=trend`,
          priority: 32,
          kind: "report",
        });
      }
    }

    // Campaigns without schedule
    const { data: campaigns } = await supabase
      .from("maps_campaigns")
      .select("id, name, business_id, schedule_enabled")
      .in("business_id", bizIds)
      .eq("schedule_enabled", false)
      .limit(5);
    for (const c of campaigns ?? []) {
      const biz = (clients ?? []).find((b) => b.id === c.business_id);
      actions.push({
        id: `sched-${c.id}`,
        title: `Set schedule for ${c.name}`,
        description: `${biz?.name ?? "Client"} campaign has no recurring scans yet.`,
        href: `/campaigns/${c.id}`,
        priority: 40,
        kind: "campaign",
      });
    }
  }

  if (!setup.firstScanRun) {
    actions.push({
      id: "first-scan",
      title: "Run your first Maps scan",
      description: "Establish a baseline grid so reports have real data.",
      href: "/scans/new",
      priority: 15,
      kind: "scan",
    });
  }

  actions.sort((a, b) => a.priority - b.priority);
  // Dedupe by id
  const seen = new Set<string>();
  const unique: NextBestAction[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    unique.push(a);
    if (unique.length >= limit) break;
  }
  return unique;
}

export async function loadBusinessNextBestActions(
  businessId: string,
  options?: { mode?: "prospect" | "client"; limit?: number }
): Promise<NextBestAction[]> {
  const supabase = createServiceClient();
  const limit = options?.limit ?? 5;
  const mode = options?.mode;
  const actions: NextBestAction[] = [];

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, account_type, prospect_status, organization_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return [];

  const isProspect =
    mode === "prospect" || (business.account_type as string) === "prospect";

  const [{ count: scanCount }, { count: campaignCount }, { count: reportCount }] =
    await Promise.all([
      supabase
        .from("scan_batches")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .in("status", ["ready", "partial", "rank_ready"]),
      supabase
        .from("maps_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
    ]);

  if ((scanCount ?? 0) === 0) {
    actions.push({
      id: "baseline-scan",
      title: isProspect ? "Run prospect Maps audit" : "Run baseline Maps scan",
      description: "Establish visibility before you pitch or track monthly.",
      href: `/businesses/${businessId}/scans`,
      priority: 10,
      kind: "scan",
    });
  }

  if (isProspect) {
    actions.push({
      id: "prospect-report",
      title: "Create prospect report",
      description: "Turn completed scans into a branded outreach deliverable.",
      href: `/businesses/${businessId}/reports?type=single_scan`,
      priority: 20,
      kind: "report",
    });
    actions.push({
      id: "growth-audit",
      title: "Run Growth Audit",
      description: "Find GBP, website, and competitor gaps for the pitch.",
      href: `/businesses/${businessId}/growth-audit`,
      priority: 25,
      kind: "audit",
    });
    if ((scanCount ?? 0) > 0) {
      actions.push({
        id: "convert",
        title: "Convert to client when they sign",
        description: "Keep keywords, scans, and reports as the baseline.",
        href: `/prospects/${businessId}?convert=1`,
        priority: 40,
        kind: "client",
      });
    }
  } else {
    if ((campaignCount ?? 0) === 0) {
      actions.push({
        id: "create-campaign",
        title: "Create a Maps campaign",
        description: "Group keywords, set baseline, and schedule recurring scans.",
        href: `/businesses/${businessId}/campaigns`,
        priority: 15,
        kind: "campaign",
      });
    }
    if ((scanCount ?? 0) > 0 && (reportCount ?? 0) === 0) {
      actions.push({
        id: "monthly-report",
        title: "Create monthly report",
        description: "Auto-pull latest vs prior and publish a client link.",
        href: `/businesses/${businessId}/reports?type=trend`,
        priority: 20,
        kind: "report",
      });
    }
    actions.push({
      id: "growth-audit-client",
      title: "Refresh Growth Audit",
      description: "Identify opportunities and turn them into tasks.",
      href: `/businesses/${businessId}/growth-audit`,
      priority: 30,
      kind: "audit",
    });
  }

  return actions.slice(0, limit);
}
