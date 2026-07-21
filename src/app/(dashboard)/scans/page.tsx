import Link from "next/link";
import {
  CheckCircle2,
  Grid3X3,
  Loader2,
  MapPin,
  Plus,
  Radar,
  XCircle,
} from "lucide-react";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import {
  ModuleHeader,
  ModulePage,
  StatCard,
  KpiGrid,
  btnPrimary,
  btnSecondary,
  cardClass,
  listClass,
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

const PAGE_SIZE = 5;

function toPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(status: string): "ok" | "warn" | "bad" | "neutral" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "ready" || s === "done") return "ok";
  if (s === "failed" || s === "error" || s === "cancelled") return "bad";
  if (s === "running" || s === "queued" || s === "pending" || s === "processing") return "warn";
  return "neutral";
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

  // Lightweight org-level KPIs from the current page + totals
  const completedOnPage = (scans ?? []).filter((s) =>
    ["completed", "ready", "done"].includes(String(s.status).toLowerCase())
  ).length;
  const runningOnPage = (scans ?? []).filter((s) =>
    isCancellableScanStatus(String(s.status))
  ).length;

  return (
    <ModulePage>
      <ModuleHeader
        icon={<Radar className="h-5 w-5 shrink-0 text-emerald-600" />}
        title="Recent Scans"
        subtitle="Maps grid history across every prospect and client — open any scan to review the rank map."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasActive ? <CancelActiveScansButton /> : null}
            <Link href="/scans/new" className={btnPrimary}>
              <Plus className="h-4 w-4" />
              New scan
            </Link>
          </div>
        }
      />

      {total > 0 ? (
        <KpiGrid cols={3}>
          <StatCard
            label="Total scans"
            value={total}
            sub="Across your workspace"
            icon={<Grid3X3 className="h-3 w-3" />}
          />
          <StatCard
            label="On this page"
            value={completedOnPage}
            sub="Completed results shown"
            icon={<CheckCircle2 className="h-3 w-3" />}
            iconWrapClassName="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="In progress"
            value={runningOnPage}
            sub={runningOnPage ? "Can be cancelled" : "Nothing running here"}
            icon={<Loader2 className="h-3 w-3" />}
            iconWrapClassName="bg-amber-50 text-amber-600"
          />
        </KpiGrid>
      ) : null}

      {!scans?.length ? (
        <ModuleEmptyState
          icon={<Radar className="h-5 w-5" />}
          title="No scans yet"
          description="Run a Maps scan for a prospect or client to track local rankings over time."
          actionLabel="Start a scan"
          actionHref="/scans/new"
        />
      ) : (
        <div className="space-y-3">
          <ul className={listClass}>
            {scans.map((s) => {
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
                  ? Math.round((Number(metrics.top3Cells) / Number(metrics.totalCells)) * 100)
                  : null;
              const keyword = conf.keyword_label ?? conf.keyword ?? "Untitled keyword";
              const safeError = customerSafeScanError(s.error_message as string | null);
              const status = String(s.status);
              const tone = statusTone(status);
              const locationName = nameById.get(s.business_id as string) ?? "Location";

              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                        tone === "ok" && "bg-emerald-50 text-emerald-600 ring-emerald-100",
                        tone === "warn" && "bg-amber-50 text-amber-600 ring-amber-100",
                        tone === "bad" && "bg-red-50 text-red-600 ring-red-100",
                        tone === "neutral" && "bg-zinc-50 text-zinc-500 ring-zinc-100"
                      )}
                    >
                      {tone === "ok" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : tone === "bad" ? (
                        <XCircle className="h-4 w-4" />
                      ) : tone === "warn" ? (
                        <Loader2 className="h-4 w-4" />
                      ) : (
                        <Grid3X3 className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/businesses/${s.business_id}/grid/${s.id}`}
                          className="truncate text-sm font-semibold text-zinc-900 hover:text-[#137752]"
                        >
                          {keyword}
                        </Link>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          {locationName}
                        </span>
                        <span>·</span>
                        <span>
                          {s.grid_size}×{s.grid_size} grid
                        </span>
                        {s.center_label ? (
                          <>
                            <span>·</span>
                            <span className="truncate">{s.center_label}</span>
                          </>
                        ) : null}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
                          Avg rank{" "}
                          <span className="ml-1 tabular-nums text-zinc-900">
                            {metrics.averageRank != null
                              ? Math.round(Number(metrics.averageRank) * 10) / 10
                              : "—"}
                          </span>
                        </span>
                        <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
                          Top 3{" "}
                          <span className="ml-1 tabular-nums text-zinc-900">
                            {top3Pct != null ? `${top3Pct}%` : "—"}
                          </span>
                        </span>
                        <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
                          Visibility{" "}
                          <span className="ml-1 tabular-nums text-zinc-900">
                            {metrics.visibilityScore != null
                              ? `${Math.round(Number(metrics.visibilityScore))}%`
                              : "—"}
                          </span>
                        </span>
                        <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200/80">
                          {formatDate(s.created_at as string)}
                        </span>
                      </div>
                      {safeError ? (
                        <p className="mt-1.5 text-xs text-amber-800">{safeError}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                    {isCancellableScanStatus(status) ? (
                      <CancelScanButton scanId={String(s.id)} />
                    ) : null}
                    <Link
                      href={`/businesses/${s.business_id}/grid/${s.id}`}
                      className={cn(btnSecondary, "h-8 px-3 text-xs")}
                    >
                      Open grid
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(
              cardClass,
              "flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-zinc-600"
            )}
          >
            <span className="text-xs tabular-nums text-zinc-500">
              Showing {from + 1}–{Math.min(to + 1, total)} of {total} scans
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={hasPrev ? `/scans?page=${currentPage - 1}` : "/scans"}
                aria-disabled={!hasPrev}
                className={cn(
                  btnSecondary,
                  "h-8 px-3 text-xs",
                  !hasPrev && "pointer-events-none opacity-50"
                )}
              >
                Previous
              </Link>
              <span className="text-xs font-medium tabular-nums text-zinc-500">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={hasNext ? `/scans?page=${currentPage + 1}` : `/scans?page=${currentPage}`}
                aria-disabled={!hasNext}
                className={cn(
                  btnSecondary,
                  "h-8 px-3 text-xs",
                  !hasNext && "pointer-events-none opacity-50"
                )}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
