"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  rows: initialRows,
  total: initialTotal,
}: {
  businessId: string;
  rows: DashboardScanRow[];
  total: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    setRows(initialRows);
    setTotal(initialTotal);
  }, [initialRows, initialTotal]);

  const hasActive = rows.some(
    (scan) => scan.active || isScanActivelyRunning(scan.status)
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/recent-scans?preview=3`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { rows?: DashboardScanRow[]; total?: number };
      if (Array.isArray(json.rows)) setRows(json.rows);
      if (typeof json.total === "number") setTotal(json.total);
    } catch {
      /* ignore transient poll errors */
    }
  }, [businessId]);

  // While any scan is active, poll every 5s so the spinner becomes a heatmap
  // without the user leaving or manually refreshing the dashboard.
  useEffect(() => {
    if (!hasActive) return;
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [hasActive, poll]);

  return (
    <section className={cn(dashboardCard, "overflow-hidden rounded-xl p-0 shadow-[0_8px_30px_rgba(15,23,42,0.05)]")}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
        <h2 className={cn(dashboardCardTitle, "text-lg")}>Recent Maps Scans</h2>
        <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-zinc-500">
          No scans yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
            Run your first scan
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className={cn(dashboardSectionLabel, "px-5 py-3 text-left")}>Keyword</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>Date</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>Grid</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>ARP</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>SOLV / SAIV</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>Change</th>
                <th className={cn(dashboardSectionLabel, "px-4 py-3 text-left")}>Heatmap</th>
                <th className={cn(dashboardSectionLabel, "px-5 py-3 text-right")}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((scan) => {
                const active = scan.active || isScanActivelyRunning(scan.status);
                return (
                  <tr key={scan.id} className="transition-colors hover:bg-[#137752]/[0.03]">
                    <td className="px-5 py-3.5 text-sm font-semibold text-zinc-900">
                      {scan.keyword ?? "Historical scan"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-zinc-500">
                      {formatScanDate(scan.createdAt || scan.finishedAt)}
                    </td>
                    <td className="px-4 py-3.5 text-xs tabular-nums text-zinc-500">
                      {scan.gridSize}×{scan.gridSize}
                    </td>
                    <td className="px-4 py-3.5 text-base font-semibold tabular-nums text-zinc-900">
                      {active ? "—" : (scan.arp ?? "—")}
                    </td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-zinc-700">
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
                    <td className="px-4 py-3.5">
                      {active ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : (
                        <ChangeCell value={scan.change} />
                      )}
                    </td>
                    <td className="px-4 py-3.5">
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
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/businesses/${businessId}/grid/${scan.id}`}
                        className={cn(btnSecondary, "h-8 px-3 text-xs font-semibold")}
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5 text-xs text-zinc-500">
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
