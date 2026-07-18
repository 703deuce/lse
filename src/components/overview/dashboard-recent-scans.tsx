"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";
import { ScanMiniHeatmap } from "@/components/overview/scan-mini-heatmap";
import {
  dashboardAccentLink,
  dashboardCard,
  dashboardCardTitle,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { isScanActivelyRunning } from "@/lib/scans/status";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return <span className="text-[12px] tabular-nums text-zinc-400">—</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        "text-[12px] font-semibold tabular-nums",
        positive ? "text-emerald-600" : "text-red-600"
      )}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

function MapPreviewPlaceholder({
  completedCells,
  totalCells,
  status,
}: {
  completedCells: number;
  totalCells: number;
  status: string;
}) {
  const finalizing = status === "normalizing";
  return (
    <div className="flex h-10 w-[88px] flex-col items-center justify-center gap-0.5 rounded-md bg-zinc-100 text-zinc-600">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      <span className="text-[9px] font-medium leading-tight">Scan in progress</span>
      {finalizing && totalCells > 0 ? (
        <span className="text-[8px] text-zinc-500">
          Finalizing {completedCells} of {totalCells}
        </span>
      ) : (
        <span className="text-[8px] text-zinc-500">Collecting map rankings…</span>
      )}
    </div>
  );
}

export function DashboardRecentScans({
  businessId,
  rows,
  total,
}: {
  businessId: string;
  rows: DashboardScanRow[];
  total: number;
}) {
  const router = useRouter();
  const hasActive = rows.some(
    (scan) => scan.active || isScanActivelyRunning(scan.status)
  );

  useEffect(() => {
    if (!hasActive) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [hasActive, router]);

  return (
    <section className={cn(dashboardCard, "overflow-hidden p-0")}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5">
        <h2 className={dashboardCardTitle}>Recent Maps Scans</h2>
        <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-3.5 py-8 text-center text-[13px] text-zinc-500">
          No scans yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
            Run your first scan
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Keyword</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Date</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Grid</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>ARP</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>SOLV / SAIV</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Change</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Heatmap</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-right")}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((scan) => {
                const active = scan.active || isScanActivelyRunning(scan.status);
                return (
                  <tr key={scan.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-3.5 py-2 text-[13px] font-medium text-zinc-900">
                      {scan.keyword ?? "Historical scan"}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2 text-[12px] tabular-nums text-zinc-500">
                      {formatScanDate(scan.createdAt || scan.finishedAt)}
                    </td>
                    <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-500">
                      {scan.gridSize}×{scan.gridSize}
                    </td>
                    <td className="px-3.5 py-2 text-[13px] font-semibold tabular-nums text-zinc-900">
                      {active ? "—" : (scan.arp ?? "—")}
                    </td>
                    <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-600">
                      {active ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <>
                          {scan.solv != null ? `${scan.solv}%` : "—"}
                          {scan.saiv != null && (
                            <span className="text-zinc-400"> / {scan.saiv}%</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3.5 py-2">
                      {active ? (
                        <span className="text-[12px] text-zinc-400">—</span>
                      ) : (
                        <ChangeCell value={scan.change} />
                      )}
                    </td>
                    <td className="px-3.5 py-2">
                      {active ? (
                        <MapPreviewPlaceholder
                          completedCells={scan.completedCells}
                          totalCells={scan.totalCells}
                          status={scan.status}
                        />
                      ) : scan.status === "failed" || scan.status === "cancelled" ? (
                        <div className="flex h-10 w-[88px] items-center justify-center rounded-md bg-zinc-100 text-[10px] font-medium text-zinc-500">
                          {scan.status === "cancelled" ? "Cancelled" : "Failed"}
                        </div>
                      ) : (
                        <ScanMiniHeatmap ranks={scan.ranks} gridSize={scan.gridSize} />
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <Link
                        href={`/businesses/${businessId}/grid/${scan.id}`}
                        className={cn(btnSecondary, "h-7 px-2.5 text-[11px] font-medium")}
                      >
                        {active ? "View" : "Open"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/40 px-3.5 py-2 text-[11px] text-zinc-500">
        <span className="tabular-nums">
          Showing {rows.length} of {total} scan{total === 1 ? "" : "s"}
        </span>
        <Link
          href={`/businesses/${businessId}/scans`}
          className={cn(dashboardAccentLink, "inline-flex items-center gap-1")}
        >
          Full history
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
