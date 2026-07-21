import Link from "next/link";
import { Plus, Radar } from "lucide-react";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import {
  PageHeader,
  ModulePage,
  MetricStrip,
  btnPrimary,
  btnGhost,
  listClass,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
} from "@/components/ui/design-system";
import { StatusBadge } from "@/components/ui/metric-card";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { isCancellableScanStatus } from "@/lib/scans/cancel-scan";
import {
  CancelActiveScansButton,
  CancelScanButton,
} from "@/components/scan/cancel-active-scans-button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function toPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Scan History — find and compare completed Maps scans.
 */
export default async function OrgScansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const auth = await requirePageAuth();
  const sp = await searchParams;
  const page = toPositiveInt(sp.page, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", auth.organizationId);

  const ids = (businesses ?? []).map((b) => b.id as string);
  const nameById = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));

  const { data: scans, count } = ids.length
    ? await supabase
        .from("scan_batches")
        .select(
          "id, business_id, status, grid_size, radius_meters, created_at, finished_at, error_message, confidence_summary, aggregate_metrics, center_label",
          { count: "exact" }
        )
        .in("business_id", ids)
        .order("created_at", { ascending: false })
        .range(from, to)
    : { data: [] as never[], count: 0 };

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const hasActive = (scans ?? []).some((s) => isCancellableScanStatus(String(s.status)));
  const runningCount = (scans ?? []).filter((s) =>
    isCancellableScanStatus(String(s.status))
  ).length;

  const { count: campaignCount } = ids.length
    ? await supabase
        .from("maps_campaigns")
        .select("id", { count: "exact", head: true })
        .in("business_id", ids)
        .in("status", ["active", "scheduled", "running"])
    : { count: 0 };

  return (
    <ModulePage>
      <PageHeader
        title="Scan History"
        description="Find and compare completed Maps scans across your locations."
        secondaryActions={hasActive ? <CancelActiveScansButton /> : undefined}
        primaryAction={
          <Link href="/scans/new" className={btnPrimary}>
            <Plus className="h-4 w-4" />
            New scan
          </Link>
        }
      />

      {!scans?.length ? (
        <ModuleEmptyState
          icon={<Radar className="h-5 w-5" />}
          title="No scans yet"
          description="Run a Maps scan for a prospect or client to track local rankings over time."
          actionLabel="Start a scan"
          actionHref="/scans/new"
        />
      ) : (
        <div className="space-y-6">
          <MetricStrip
            items={[
              { label: "Total scans", value: String(total) },
              {
                label: "Scheduled campaigns",
                value: String(campaignCount ?? 0),
              },
              {
                label: "Currently running",
                value: String(runningCount),
              },
            ]}
          />

          <div className={cn(listClass, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={cn("border-b border-[var(--border)]", tableHeadClass)}>
                    <th className={cn(tableCellClass, "py-2.5 text-left")}>Keyword</th>
                    <th className={cn(tableCellClass, "py-2.5 text-left")}>Location</th>
                    <th className={cn(tableCellClass, "py-2.5 text-left")}>Grid</th>
                    <th className={cn(tableCellClass, "py-2.5 text-right")}>Avg rank</th>
                    <th className={cn(tableCellClass, "py-2.5 text-right")}>Top 3</th>
                    <th className={cn(tableCellClass, "py-2.5 text-left")}>Status</th>
                    <th className={cn(tableCellClass, "py-2.5 text-left")}>Date</th>
                    <th className={cn(tableCellClass, "py-2.5 text-right")}> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {scans.map((s) => {
                    const conf = (s.confidence_summary ?? {}) as {
                      keyword?: string;
                      keyword_label?: string;
                    };
                    const metrics = (s.aggregate_metrics ?? {}) as {
                      averageRank?: number | null;
                      top3Cells?: number | null;
                      totalCells?: number | null;
                    };
                    const top3Pct =
                      metrics.top3Cells != null && metrics.totalCells
                        ? Math.round(
                            (Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100
                          )
                        : null;
                    const keyword = conf.keyword_label ?? conf.keyword ?? "Untitled keyword";
                    const safeError = customerSafeScanError(s.error_message as string | null);
                    const status = String(s.status);
                    const locationName = nameById.get(s.business_id as string) ?? "Location";

                    return (
                      <tr key={s.id} className={tableRowHoverClass}>
                        <td className={tableCellClass}>
                          <Link
                            href={`/businesses/${s.business_id}/grid/${s.id}`}
                            className="font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                          >
                            {keyword}
                          </Link>
                          {safeError ? (
                            <p className="mt-1 text-xs text-amber-800">{safeError}</p>
                          ) : null}
                        </td>
                        <td className={cn(tableCellClass, "text-[var(--text-secondary)]")}>
                          {locationName}
                        </td>
                        <td className={cn(tableCellClass, "tabular-nums text-[var(--text-secondary)]")}>
                          {s.grid_size}×{s.grid_size}
                        </td>
                        <td className={cn(tableCellClass, "text-right font-semibold tabular-nums text-[var(--text)]")}>
                          {metrics.averageRank != null
                            ? Math.round(Number(metrics.averageRank) * 10) / 10
                            : "—"}
                        </td>
                        <td className={cn(tableCellClass, "text-right tabular-nums text-[var(--text-secondary)]")}>
                          {top3Pct != null ? `${top3Pct}%` : "—"}
                        </td>
                        <td className={tableCellClass}>
                          <StatusBadge status={status} />
                        </td>
                        <td className={cn(tableCellClass, "text-[var(--text-muted)]")}>
                          {formatDate(s.created_at as string)}
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          <div className="inline-flex items-center gap-2">
                            {isCancellableScanStatus(status) ? (
                              <CancelScanButton scanId={String(s.id)} />
                            ) : null}
                            <Link
                              href={`/businesses/${s.business_id}/grid/${s.id}`}
                              className={cn(btnGhost, "h-8 px-3 text-xs")}
                            >
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Page {currentPage} of {totalPages} · {total} scans
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link href={`/scans?page=${currentPage - 1}`} className={btnGhost}>
                  Previous
                </Link>
              ) : (
                <span className={cn(btnGhost, "pointer-events-none opacity-40")}>Previous</span>
              )}
              {hasNext ? (
                <Link href={`/scans?page=${currentPage + 1}`} className={btnGhost}>
                  Next
                </Link>
              ) : (
                <span className={cn(btnGhost, "pointer-events-none opacity-40")}>Next</span>
              )}
            </div>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
