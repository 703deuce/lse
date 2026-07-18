import type { createServiceClient } from "@/lib/db/client";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type WorkingQueueItem = {
  id: string;
  kind:
    | "scan_running"
    | "scan_completed"
    | "report_due"
    | "client_needs_scan"
    | "schedule_upcoming"
    | "draft_report"
    | "prospect_shared";
  title: string;
  subtitle: string;
  href: string;
  at: string | null;
};

export type WorkingQueue = {
  scansRunning: WorkingQueueItem[];
  scansCompleted: WorkingQueueItem[];
  reportsDue: WorkingQueueItem[];
  clientsNeedScan: WorkingQueueItem[];
  schedulesUpcoming: WorkingQueueItem[];
  draftReports: WorkingQueueItem[];
  prospectAudits: WorkingQueueItem[];
};

/**
 * Org-level working queue for solo consultants — not a generic analytics homepage.
 */
export async function loadWorkingQueue(
  supabase: ServiceClient,
  organizationId: string
): Promise<WorkingQueue> {
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, prospect_status, is_tracked, archived_at, updated_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(80);

  const bizMap = new Map(
    (businesses ?? []).map((b) => [b.id as string, b as { id: string; name: string; account_type: string | null }])
  );
  const businessIds = [...bizMap.keys()];

  const empty: WorkingQueue = {
    scansRunning: [],
    scansCompleted: [],
    reportsDue: [],
    clientsNeedScan: [],
    schedulesUpcoming: [],
    draftReports: [],
    prospectAudits: [],
  };
  if (!businessIds.length) return empty;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86400000).toISOString();
  const now = new Date().toISOString();

  const [{ data: running }, { data: completed }, { data: campaigns }, { data: drafts }, { data: recentReports }] =
    await Promise.all([
      supabase
        .from("scan_batches")
        .select("id, business_id, status, confidence_summary, created_at, updated_at")
        .in("business_id", businessIds)
        .in("status", ["queued", "processing", "recovering", "pending"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("scan_batches")
        .select("id, business_id, status, confidence_summary, finished_at, created_at")
        .in("business_id", businessIds)
        .in("status", ["ready", "partial", "rank_ready"])
        .order("finished_at", { ascending: false })
        .limit(12),
      supabase
        .from("maps_campaigns")
        .select(
          "id, business_id, name, schedule_enabled, next_scheduled_at, schedule_type"
        )
        .in("business_id", businessIds)
        .is("archived_at", null)
        .eq("schedule_enabled", true)
        .not("next_scheduled_at", "is", null)
        .lte("next_scheduled_at", sevenDaysAhead)
        .order("next_scheduled_at", { ascending: true })
        .limit(20),
      supabase
        .from("reports")
        .select("id, business_id, report_type, publish_status, generated_at, updated_at")
        .in("business_id", businessIds)
        .eq("publish_status", "draft")
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase
        .from("reports")
        .select(
          "id, business_id, report_type, publish_status, share_token, share_last_viewed_at, generated_at"
        )
        .in("business_id", businessIds)
        .eq("report_type", "single_scan")
        .not("share_token", "is", null)
        .order("generated_at", { ascending: false })
        .limit(20),
    ]);

  function scanLabel(row: { confidence_summary?: unknown }): string {
    const conf = (row.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    if (conf.keyword_label?.trim()) return conf.keyword_label.trim();
    return "Maps scan";
  }

  const scansRunning: WorkingQueueItem[] = (running ?? []).map((s) => {
    const biz = bizMap.get(s.business_id as string);
    return {
      id: `run-${s.id}`,
      kind: "scan_running" as const,
      title: scanLabel(s),
      subtitle: `${biz?.name ?? "Location"} · ${String(s.status)}`,
      href: `/businesses/${s.business_id}/scans`,
      at: (s.updated_at as string | null) ?? (s.created_at as string | null),
    };
  });

  const scansCompleted: WorkingQueueItem[] = (completed ?? []).map((s) => {
    const biz = bizMap.get(s.business_id as string);
    return {
      id: `done-${s.id}`,
      kind: "scan_completed" as const,
      title: scanLabel(s),
      subtitle: `${biz?.name ?? "Location"} · ready`,
      href: `/businesses/${s.business_id}/grid/${s.id}`,
      at: (s.finished_at as string | null) ?? (s.created_at as string | null),
    };
  });

  const schedulesUpcoming: WorkingQueueItem[] = (campaigns ?? []).map((c) => {
    const biz = bizMap.get(c.business_id as string);
    const due = c.next_scheduled_at as string;
    const overdue = due < now;
    return {
      id: `sched-${c.id}`,
      kind: overdue ? ("report_due" as const) : ("schedule_upcoming" as const),
      title: String(c.name),
      subtitle: `${biz?.name ?? "Client"} · ${overdue ? "scan overdue" : "scheduled"} · ${c.schedule_type}`,
      href: `/campaigns/${c.id}`,
      at: due,
    };
  });

  const draftReports: WorkingQueueItem[] = (drafts ?? []).map((r) => {
    const biz = bizMap.get(r.business_id as string);
    return {
      id: `draft-${r.id}`,
      kind: "draft_report" as const,
      title: "Draft report",
      subtitle: `${biz?.name ?? "Location"} · ${String(r.report_type).replace(/_/g, " ")}`,
      href: `/reports/${r.id}`,
      at: (r.updated_at as string | null) ?? (r.generated_at as string | null),
    };
  });

  const prospectIds = new Set(
    (businesses ?? [])
      .filter((b) => b.account_type === "prospect")
      .map((b) => b.id as string)
  );
  const prospectAudits: WorkingQueueItem[] = (recentReports ?? [])
    .filter((r) => prospectIds.has(r.business_id as string))
    .slice(0, 8)
    .map((r) => {
      const biz = bizMap.get(r.business_id as string);
      return {
        id: `prospect-${r.id}`,
        kind: "prospect_shared" as const,
        title: "Prospect audit shared",
        subtitle: `${biz?.name ?? "Prospect"}${r.share_last_viewed_at ? " · opened" : " · waiting"}`,
        href: `/prospects/${r.business_id}`,
        at: (r.generated_at as string | null) ?? null,
      };
    });

  // Clients without a completed scan in the last 30 days
  const clientIds = (businesses ?? [])
    .filter(
      (b) =>
        (b.account_type === "client" || b.account_type == null) &&
        b.is_tracked !== false
    )
    .map((b) => b.id as string);

  const clientsNeedScan: WorkingQueueItem[] = [];
  if (clientIds.length) {
    const { data: recentByBiz } = await supabase
      .from("scan_batches")
      .select("business_id, finished_at, created_at")
      .in("business_id", clientIds)
      .in("status", ["ready", "partial", "rank_ready"])
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);

    const hasRecent = new Set((recentByBiz ?? []).map((r) => r.business_id as string));
    for (const id of clientIds) {
      if (hasRecent.has(id)) continue;
      const biz = bizMap.get(id);
      if (!biz) continue;
      clientsNeedScan.push({
        id: `needs-${id}`,
        kind: "client_needs_scan",
        title: biz.name,
        subtitle: "No completed scan in the last 30 days",
        href: `/clients/${id}`,
        at: null,
      });
      if (clientsNeedScan.length >= 12) break;
    }
  }

  const reportsDue: WorkingQueueItem[] = [];
  for (const c of clientsNeedScan.slice(0, 6)) {
    const bizId = c.id.replace(/^needs-/, "");
    reportsDue.push({
      id: `rdue-${bizId}`,
      kind: "report_due",
      title: c.title,
      subtitle: "Consider a monthly progress report",
      href: `/businesses/${bizId}/reports?type=maps_campaign`,
      at: null,
    });
  }
  for (const s of schedulesUpcoming.filter((i) => i.kind === "report_due")) {
    reportsDue.push(s);
  }

  return {
    scansRunning,
    scansCompleted,
    reportsDue,
    clientsNeedScan,
    schedulesUpcoming: schedulesUpcoming.filter((i) => i.kind === "schedule_upcoming"),
    draftReports,
    prospectAudits,
  };
}
