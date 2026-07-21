import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, btnSecondary, emptyStateClass, listClass } from "@/components/ui/design-system";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { isCancellableScanStatus } from "@/lib/scans/cancel-scan";
import {
  CancelActiveScansButton,
  CancelScanButton,
} from "@/components/scan/cancel-active-scans-button";

const PAGE_SIZE = 15;

function toPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not finished";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

  const hasActive = (scans ?? []).some((s) =>
    isCancellableScanStatus(String(s.status))
  );

  return (
    <>
      <PageHeader
        title="Recent Scans"
        subtitle="Paginated Maps scan history across your prospects and clients."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasActive ? <CancelActiveScansButton /> : null}
            <Link href="/scans/new" className={btnPrimary}>
              New scan
            </Link>
          </div>
        }
      />

      {!scans?.length ? (
        <div className={emptyStateClass}>
          <h2 className="text-base font-semibold text-zinc-900">No scans yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Run a Maps scan for a prospect or client to track local rankings over time.
          </p>
          <Link
            href="/scans/new"
            className="mt-4 inline-block text-sm font-medium text-[#137752] hover:underline"
          >
            Start a scan
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <ul className={listClass}>
            {scans.map((s) => {
              const conf = (s.confidence_summary ?? {}) as { keyword?: string; keyword_label?: string };
              const metrics = (s.aggregate_metrics ?? {}) as {
                averageRank?: number | null;
                top3Cells?: number | null;
                totalCells?: number | null;
                visibilityScore?: number | null;
              };
              const top3Pct =
                metrics.top3Cells != null && metrics.totalCells
                  ? Math.round((Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100)
                  : null;
            const keyword = conf.keyword_label ?? conf.keyword ?? "—";
            const safeError = customerSafeScanError(s.error_message as string | null);
            return (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/businesses/${s.business_id}/grid/${s.id}`}
                    className="text-sm font-semibold text-zinc-900 hover:text-[#137752]"
                  >
                    {nameById.get(s.business_id as string) ?? "Location"} · {keyword}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {s.grid_size}×{s.grid_size} · {String(s.status)} · Created {formatDate(s.created_at as string)}
                    {s.finished_at ? ` · Finished ${formatDate(s.finished_at as string)}` : ""}
                    {s.center_label ? ` · ${s.center_label}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Avg rank{" "}
                    <span className="font-medium text-zinc-700">
                      {metrics.averageRank != null
                        ? Math.round(Number(metrics.averageRank) * 10) / 10
                        : "—"}
                    </span>
                    {" · "}Top 3 cells{" "}
                    <span className="font-medium text-zinc-700">
                      {top3Pct != null ? `${top3Pct}%` : "—"}
                    </span>
                    {" · "}Visibility{" "}
                    <span className="font-medium text-zinc-700">
                      {metrics.visibilityScore != null
                        ? `${Math.round(Number(metrics.visibilityScore))}%`
                        : "—"}
                    </span>
                  </p>
                  {safeError ? (
                    <p className="mt-1 text-xs text-amber-800">{safeError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isCancellableScanStatus(String(s.status)) ? (
                    <CancelScanButton scanId={String(s.id)} />
                  ) : null}
                  <Link
                    href={`/businesses/${s.business_id}/grid/${s.id}`}
                    className="text-xs font-medium text-[#137752] hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-600 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <span className="text-xs tabular-nums text-zinc-500">
              Showing {from + 1}-{Math.min(to + 1, total)} of {total} scans
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={hasPrev ? `/scans?page=${currentPage - 1}` : "/scans"}
                aria-disabled={!hasPrev}
                className={`${btnSecondary} h-8 px-3 text-xs ${!hasPrev ? "pointer-events-none opacity-50" : ""}`}
              >
                Previous
              </Link>
              <span className="text-xs font-medium tabular-nums text-zinc-500">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={hasNext ? `/scans?page=${currentPage + 1}` : `/scans?page=${currentPage}`}
                aria-disabled={!hasNext}
                className={`${btnSecondary} h-8 px-3 text-xs ${!hasNext ? "pointer-events-none opacity-50" : ""}`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
