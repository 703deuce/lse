import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { loadWorkingQueue } from "@/lib/workspace/working-queue";
import { httpErrorFromException } from "@/lib/security/http-errors";

/**
 * Org dashboard work queue buckets + light recent results for the journey home.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();
    const queue = await loadWorkingQueue(supabase, auth.organizationId);

    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("organization_id", auth.organizationId)
      .is("archived_at", null)
      .limit(80);
    const bizMap = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));
    const ids = [...bizMap.keys()];

    type Recent = {
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      href: string;
      at: string | null;
    };
    const recent: Recent[] = [];

    if (ids.length) {
      const [{ data: scans }, { data: audits }, { data: aiRuns }, { data: reports }] =
        await Promise.all([
          supabase
            .from("scan_batches")
            .select("id, business_id, status, finished_at, created_at, confidence_summary")
            .in("business_id", ids)
            .in("status", ["ready", "partial", "rank_ready"])
            .order("finished_at", { ascending: false })
            .limit(8),
          supabase
            .from("growth_audit_runs")
            .select("id, business_id, status, created_at, growth_score")
            .in("business_id", ids)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("ai_visibility_runs")
            .select("id, business_id, status, finished_at, created_at, visibility_score")
            .in("business_id", ids)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("reports")
            .select(
              "id, business_id, report_type, publish_status, generated_at, share_last_viewed_at"
            )
            .in("business_id", ids)
            .order("generated_at", { ascending: false })
            .limit(8),
        ]);

      for (const s of scans ?? []) {
        const name = bizMap.get(s.business_id as string) ?? "Client";
        const conf = (s.confidence_summary ?? {}) as { keyword_label?: string };
        recent.push({
          id: `scan-${s.id}`,
          kind: "maps_scan",
          title: `Maps scan · ${name}`,
          subtitle: conf.keyword_label?.trim() || String(s.status ?? "Completed"),
          href: `/businesses/${s.business_id}/grid/${s.id}`,
          at: (s.finished_at as string) ?? (s.created_at as string) ?? null,
        });
      }
      for (const a of audits ?? []) {
        const name = bizMap.get(a.business_id as string) ?? "Client";
        recent.push({
          id: `audit-${a.id}`,
          kind: "growth_audit",
          title: `Growth Audit · ${name}`,
          subtitle:
            a.growth_score != null
              ? `Score ${a.growth_score} · ${String(a.status ?? "")}`
              : String(a.status ?? "Completed"),
          href: `/businesses/${a.business_id}/growth-audit`,
          at: (a.created_at as string) ?? null,
        });
      }
      for (const r of aiRuns ?? []) {
        const name = bizMap.get(r.business_id as string) ?? "Client";
        recent.push({
          id: `ai-${r.id}`,
          kind: "ai_visibility",
          title: `AI Visibility · ${name}`,
          subtitle:
            r.visibility_score != null
              ? `Score ${r.visibility_score}`
              : String(r.status ?? "Run"),
          href: `/businesses/${r.business_id}/ai-visibility`,
          at: (r.finished_at as string) ?? (r.created_at as string) ?? null,
        });
      }
      for (const r of reports ?? []) {
        const name = bizMap.get(r.business_id as string) ?? "Client";
        const viewed = r.share_last_viewed_at ? " · viewed" : "";
        recent.push({
          id: `report-${r.id}`,
          kind: "report",
          title: `${String(r.report_type ?? "Report").replace(/_/g, " ")} · ${name}`,
          subtitle: `${String(r.publish_status ?? "published")}${viewed}`,
          href: `/reports/${r.id}`,
          at: (r.generated_at as string) ?? null,
        });
      }
    }

    recent.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));

    const needsAttention = [
      ...queue.clientsNeedScan.slice(0, 5),
      ...queue.reportsDue.slice(0, 5),
      ...queue.draftReports.slice(0, 4),
      ...queue.prospectAudits.slice(0, 4),
    ];

    return NextResponse.json({
      queue,
      needsAttention,
      recent: recent.slice(0, 12),
      activeWork: {
        scansRunning: queue.scansRunning,
        schedulesUpcoming: queue.schedulesUpcoming,
        draftReports: queue.draftReports,
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load work queue");
  }
}
