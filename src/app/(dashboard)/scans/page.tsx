import Link from "next/link";
import { Crosshair, Eye, Plus, RefreshCw, Target } from "lucide-react";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { isCancellableScanStatus } from "@/lib/scans/cancel-scan";
import {
  CancelActiveScansButton,
  CancelScanButton,
} from "@/components/scan/cancel-active-scans-button";
import {
  MockMetricCard,
  MockPageHeader,
  MockTableShell,
  mock,
} from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function toPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function visibilityTone(pct: number | null): { label: string; className: string } {
  if (pct == null) return { label: "—", className: "bg-[#F2F4F7] text-[#475467]" };
  if (pct >= 60) return { label: "High", className: "bg-[#ECFDF3] text-[#027A48]" };
  if (pct >= 30) return { label: "Mid", className: "bg-[#FFFAEB] text-[#B54708]" };
  return { label: "Low", className: "bg-[#FEF3F2] text-[#B42318]" };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

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
    .select("id, name, address_text, scan_center_label")
    .eq("organization_id", auth.organizationId);

  const ids = (businesses ?? []).map((b) => b.id as string);
  const bizById = new Map(
    (businesses ?? []).map((b) => [
      b.id as string,
      {
        name: b.name as string,
        place:
          (b.scan_center_label as string | null)?.trim() ||
          (b.address_text as string | null)?.trim() ||
          "",
      },
    ])
  );

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

  const { data: allMetrics } = ids.length
    ? await supabase
        .from("scan_batches")
        .select("id, confidence_summary, aggregate_metrics, status")
        .in("business_id", ids)
        .limit(500)
    : { data: [] as never[] };

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const hasActive = (scans ?? []).some((s) => isCancellableScanStatus(String(s.status)));

  const keywordSet = new Set<string>();
  let rankSum = 0;
  let rankCount = 0;
  let visSum = 0;
  let visCount = 0;
  for (const s of allMetrics ?? []) {
    const conf = (s.confidence_summary ?? {}) as { keyword?: string; keyword_label?: string };
    const kw = conf.keyword_label ?? conf.keyword;
    if (kw) keywordSet.add(String(kw).toLowerCase());
    const metrics = (s.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      visibilityScore?: number | null;
      top3Cells?: number | null;
      totalCells?: number | null;
    };
    if (metrics.averageRank != null) {
      rankSum += Number(metrics.averageRank);
      rankCount += 1;
    }
    const vis =
      metrics.visibilityScore != null
        ? Number(metrics.visibilityScore)
        : metrics.top3Cells != null && metrics.totalCells
          ? (Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100
          : null;
    if (vis != null) {
      visSum += vis;
      visCount += 1;
    }
  }
  const avgRank = rankCount ? Math.round((rankSum / rankCount) * 10) / 10 : null;
  const avgVis = visCount ? Math.round(visSum / visCount) : null;

  return (
    <div className={mock.page}>
      <MockPageHeader
        title="Recent Scans"
        subtitle="Improve rankings and visibility with our geo-grid rank tracker."
        actions={
          <>
            {hasActive ? <CancelActiveScansButton /> : null}
            <Link href="/scans/new" className={mock.btnPrimary}>
              <Plus className="h-4 w-4" />
              New Scan
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MockMetricCard
          label="Total Scans"
          value={total}
          icon={Target}
          hint="Across all locations"
        />
        <MockMetricCard
          label="Keywords"
          value={keywordSet.size}
          icon={RefreshCw}
          iconClassName="bg-[#EFF8FF] text-[#175CD3]"
          hint="Unique tracked keywords"
        />
        <MockMetricCard
          label="Avg. Rank"
          value={avgRank ?? "—"}
          icon={Crosshair}
          iconClassName="bg-[#F4F3FF] text-[#5925DC]"
          hint="Portfolio average"
        />
        <MockMetricCard
          label="Visibility"
          value={avgVis != null ? `${avgVis}%` : "—"}
          icon={Eye}
          iconClassName="bg-[#FEF6EE] text-[#C4320A]"
          hint="Avg Top 3 share"
        />
      </div>

      {!scans?.length ? (
        <div className={cn(mock.card, "px-6 py-12 text-center")}>
          <h2 className="text-base font-semibold text-[#101828]">No scans yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
            Run a Maps scan for a prospect or client to track local rankings over time.
          </p>
          <Link href="/scans/new" className={cn(mock.btnPrimary, "mt-4")}>
            <Plus className="h-4 w-4" />
            Start a scan
          </Link>
        </div>
      ) : (
        <MockTableShell title="Recent Scans" subtitle={`${total} total scans`}>
          <table className="min-w-full">
            <thead>
              <tr className={mock.tableHead}>
                <th className="px-4 py-3">Scan Details</th>
                <th className="px-4 py-3">ARP</th>
                <th className="px-4 py-3">SOV</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Scan Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {(scans ?? []).map((s) => {
                const conf = (s.confidence_summary ?? {}) as {
                  keyword?: string;
                  keyword_label?: string;
                };
                const metrics = (s.aggregate_metrics ?? {}) as {
                  averageRank?: number | null;
                  top3Cells?: number | null;
                  totalCells?: number | null;
                  visibilityScore?: number | null;
                };
                const top3Pct =
                  metrics.top3Cells != null && metrics.totalCells
                    ? Math.round(
                        (Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100
                      )
                    : null;
                const vis =
                  metrics.visibilityScore != null
                    ? Math.round(Number(metrics.visibilityScore))
                    : top3Pct;
                const tone = visibilityTone(vis);
                const keyword = conf.keyword_label ?? conf.keyword ?? "Untitled keyword";
                const biz = bizById.get(s.business_id as string);
                const name = biz?.name ?? "Location";
                const place = s.center_label || biz?.place || "";
                const arp =
                  metrics.averageRank != null
                    ? Math.round(Number(metrics.averageRank) * 10) / 10
                    : "—";
                const safeError = customerSafeScanError(s.error_message as string | null);

                return (
                  <tr key={s.id} className="hover:bg-[#F9FAFB]">
                    <td className={mock.tableCell}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF3] text-xs font-bold text-[#137752]">
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/businesses/${s.business_id}/grid/${s.id}`}
                            className="block truncate font-semibold text-[#101828] hover:text-[#137752]"
                          >
                            {name} — {keyword}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-[#667085]">
                            {place || `${s.grid_size}×${s.grid_size} grid`}
                          </p>
                          {safeError ? (
                            <p className="mt-1 text-xs text-amber-700">{safeError}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className={cn(mock.tableCell, "font-semibold tabular-nums")}>{arp}</td>
                    <td className={cn(mock.tableCell, "tabular-nums")}>
                      {top3Pct != null ? `${top3Pct}%` : "—"}
                    </td>
                    <td className={mock.tableCell}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          tone.className
                        )}
                      >
                        {tone.label}
                        {vis != null ? ` ${vis}%` : ""}
                      </span>
                    </td>
                    <td className={cn(mock.tableCell, "whitespace-nowrap text-[#667085]")}>
                      {formatDate(s.created_at as string)}
                    </td>
                    <td className={cn(mock.tableCell, "text-right")}>
                      <div className="inline-flex items-center gap-2">
                        {isCancellableScanStatus(String(s.status)) ? (
                          <CancelScanButton scanId={String(s.id)} />
                        ) : null}
                        <Link
                          href={`/businesses/${s.business_id}/grid/${s.id}`}
                          className={mock.link}
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F2F4F7] px-4 py-3">
            <p className="text-xs text-[#667085]">
              Rows per page: {PAGE_SIZE} · {from + 1}-{Math.min(to + 1, total)} of {total}
            </p>
            <div className="flex items-center gap-1.5">
              <Link
                href={hasPrev ? `/scans?page=${currentPage - 1}` : "/scans"}
                aria-disabled={!hasPrev}
                className={cn(
                  mock.btnSecondary,
                  "h-8 px-3 text-xs",
                  !hasPrev && "pointer-events-none opacity-40"
                )}
              >
                Previous
              </Link>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const n = i + 1;
                return (
                  <Link
                    key={n}
                    href={`/scans?page=${n}`}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold",
                      n === currentPage
                        ? "bg-[#137752] text-white"
                        : "text-[#475467] hover:bg-[#F2F4F7]"
                    )}
                  >
                    {n}
                  </Link>
                );
              })}
              <Link
                href={hasNext ? `/scans?page=${currentPage + 1}` : `/scans?page=${currentPage}`}
                aria-disabled={!hasNext}
                className={cn(
                  mock.btnSecondary,
                  "h-8 px-3 text-xs",
                  !hasNext && "pointer-events-none opacity-40"
                )}
              >
                Next
              </Link>
            </div>
          </div>
        </MockTableShell>
      )}
    </div>
  );
}
