"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  Archive,
  ArrowRight,
  Building2,
  Calendar,
  FileText,
  GripVertical,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Radar,
  RotateCcw,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
} from "@/components/ui/design-system";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { ClientPager, ShowMoreList } from "@/components/ui/show-more-list";
import {
  isClientRow,
  isProspectRow,
  PROSPECT_PIPELINE_STATUSES,
  PROSPECT_STATUS_LABELS,
  prospectPipelineStatus,
  type AccountListRow,
  type ProspectPipelineStatus,
  type ProspectStatus,
} from "@/lib/accounts/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

function locationSubtitle(b: AccountListRow): string {
  return b.address_text?.trim() || b.scan_center_label?.trim() || b.primary_category || "—";
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (status in PROSPECT_STATUS_LABELS) {
    return PROSPECT_STATUS_LABELS[status as ProspectStatus];
  }
  return status.replace(/_/g, " ");
}

function nextPipelineStatus(status: ProspectPipelineStatus): ProspectPipelineStatus | null {
  const index = PROSPECT_PIPELINE_STATUSES.indexOf(status);
  return PROSPECT_PIPELINE_STATUSES[index + 1] ?? null;
}

export function AccountsHub({
  mode,
  accessMessage,
}: {
  mode: "prospects" | "clients";
  accessMessage?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AccountListRow[]>([]);
  const [trackedCount, setTrackedCount] = useState(0);
  const [maxBusinesses, setMaxBusinesses] = useState(0);
  const [planName, setPlanName] = useState("");
  const [canAdd, setCanAdd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "archived">("all");
  const [clientFilter, setClientFilter] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.businesses ?? []);
      setTrackedCount(Number(json.trackedCount ?? 0));
      setMaxBusinesses(Number(json.maxBusinesses ?? 0));
      setPlanName(String(json.planName ?? ""));
      setCanAdd(Boolean(json.canAdd));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function convertToClient(businessId: string) {
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/convert-to-client`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 402
              ? "Active location limit reached. Archive a client or upgrade."
              : "Could not convert to client")
        );
      }
      await load();
      router.refresh();
      router.push(`/businesses/${businessId}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert to client");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveClient(businessId: string) {
    if (
      !confirm(
        "Archive this client location? It frees a plan slot. Scans and reports stay saved — you can restore later."
      )
    ) {
      return;
    }
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/untrack`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not archive");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive");
    } finally {
      setBusyId(null);
    }
  }

  async function restoreClient(businessId: string) {
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/convert-to-client`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 402
              ? "Active location limit reached. Archive another client or upgrade."
              : "Could not restore")
        );
      }
      setClientFilter("active");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore");
    } finally {
      setBusyId(null);
    }
  }

  async function updateProspectStatus(
    businessId: string,
    nextStatus: ProspectPipelineStatus
  ) {
    const current = rows.find((row) => row.id === businessId);
    if (!current) return;
    const currentStatus = prospectPipelineStatus(current.prospect_status);
    if (currentStatus === nextStatus) return;

    const previousRows = rows;
    setBusyId(businessId);
    setError(null);
    setRows((prev) =>
      prev.map((row) =>
        row.id === businessId
          ? {
              ...row,
              account_type: "prospect",
              prospect_status: nextStatus,
              archived_at: null,
            }
          : row
      )
    );

    try {
      const res = await fetch(`/api/businesses/${businessId}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectStatus: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not update prospect status");
      if (json.account) {
        setRows((prev) =>
          prev.map((row) => (row.id === businessId ? { ...row, ...json.account } : row))
        );
      }
      router.refresh();
    } catch (e) {
      setRows(previousRows);
      setError(e instanceof Error ? e.message : "Could not update prospect status");
    } finally {
      setBusyId(null);
      setDraggingId(null);
    }
  }

  const list = useMemo(() => {
    if (mode === "clients") {
      if (clientFilter === "archived") {
        return rows.filter(
          (b) =>
            !!b.archived_at ||
            (b.account_type === "client" && b.is_tracked === false)
        );
      }
      return rows.filter(isClientRow);
    }
    if (statusFilter === "archived") {
      return rows.filter(
        (b) =>
          !!b.archived_at &&
          (b.account_type === "prospect" || b.account_type == null)
      );
    }
    return rows.filter(isProspectRow);
  }, [mode, rows, statusFilter, clientFilter]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(list.length / PAGE_SIZE)));
  const pagedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, currentPage]);

  const prospectColumns = useMemo(() => {
    const columns: Record<ProspectPipelineStatus, AccountListRow[]> = {
      new: [],
      contacted: [],
      audit_sent: [],
      proposal_sent: [],
      won: [],
      lost: [],
    };

    for (const prospect of rows.filter(isProspectRow)) {
      columns[prospectPipelineStatus(prospect.prospect_status)].push(prospect);
    }

    return columns;
  }, [rows]);

  const activeProspectCount = useMemo(
    () => rows.filter(isProspectRow).length,
    [rows]
  );

  const archivedProspectCount = useMemo(
    () =>
      rows.filter(
        (b) =>
          !!b.archived_at &&
          (b.account_type === "prospect" || b.account_type == null)
      ).length,
    [rows]
  );

  const title = mode === "clients" ? "Clients" : "Prospects";
  const subtitle =
    mode === "clients"
      ? "Active client locations you track with Maps scans and branded reports."
      : "Prospect audits for outreach. Convert to a client when you win the work — scans and reports stay attached.";

  const emptyTitle = mode === "clients" ? "No clients yet" : "No prospects yet";
  const emptyBody =
    mode === "clients"
      ? "Add a client to run Maps scans, create campaigns, and deliver monthly white-label reports. Start with a baseline scan, then schedule recurring tracking."
      : "Create a prospect, run a Prospect Audit (Maps + Growth Audit), share a branded report, then convert to a client when they sign — history stays attached.";

  const newHref =
    mode === "clients" ? "/businesses/new?as=client" : "/businesses/new?as=prospect";
  const newLabel = mode === "clients" ? "New client" : "New prospect";

  return (
    <ModulePage>
      <ModuleHeader
        icon={mode === "clients" ? Building2 : Users}
        title={title}
        subtitle={subtitle}
        actions={
          mode === "clients" && !canAdd ? (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {trackedCount}/{maxBusinesses} active locations — upgrade to add more
            </span>
          ) : (
            <Link
              href={newHref}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              {newLabel}
            </Link>
          )
        }
      />

      {mode === "clients" ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-800">
            {trackedCount} / {maxBusinesses || "—"} active locations
          </span>
          {planName ? <span>{planName} plan</span> : null}
          <div className="flex gap-2">
            <FilterChip
              active={clientFilter === "active"}
              onClick={() => {
                setClientFilter("active");
                setPage(1);
              }}
              label="Active"
            />
            <FilterChip
              active={clientFilter === "archived"}
              onClick={() => {
                setClientFilter("archived");
                setPage(1);
              }}
              label="Archived"
            />
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-800">
            {activeProspectCount} active prospects
          </span>
          <FilterChip
            active={statusFilter === "all"}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            label="Pipeline board"
          />
          <FilterChip
            active={statusFilter === "archived"}
            onClick={() => {
              setStatusFilter("archived");
              setPage(1);
            }}
            label={`Archived${archivedProspectCount ? ` (${archivedProspectCount})` : ""}`}
          />
        </div>
      )}

      {accessMessage ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {accessMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : mode === "prospects" && statusFilter !== "archived" ? (
        activeProspectCount === 0 ? (
          <ModuleEmptyState
            icon={MapPin}
            title={emptyTitle}
            description={emptyBody}
            actionLabel={newLabel}
            actionHref={newHref}
          />
        ) : (
          <ProspectKanban
            columns={prospectColumns}
            busyId={busyId}
            draggingId={draggingId}
            onDragStart={(businessId) => setDraggingId(businessId)}
            onDragEnd={() => setDraggingId(null)}
            onMove={(businessId, status) => void updateProspectStatus(businessId, status)}
            onConvert={(businessId) => void convertToClient(businessId)}
          />
        )
      ) : list.length === 0 ? (
        <ModuleEmptyState
          icon={MapPin}
          title={emptyTitle}
          description={emptyBody}
          actionLabel={newLabel}
          actionHref={newHref}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pagedList.map((b) => {
              const dashboardHref = `/businesses/${b.id}/overview`;
              const detailHref =
                mode === "prospects" ? `/prospects/${b.id}` : `/clients/${b.id}`;
              return (
                <article
                  key={b.id}
                  className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#137752] text-[12px] font-bold text-white shadow-sm">
                      {initials(b.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={dashboardHref}
                        className="block truncate text-[14px] font-semibold text-zinc-900 hover:text-emerald-700"
                      >
                        {b.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-zinc-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate">{locationSubtitle(b)}</span>
                      </p>
                      {mode === "prospects" ? (
                        <p className="mt-1.5 text-[11px] capitalize text-zinc-400">
                          {statusLabel(b.prospect_status ?? "new")}
                          {b.primary_contact_name ? ` · ${b.primary_contact_name}` : ""}
                        </p>
                      ) : b.primary_category ? (
                        <span className="mt-1.5 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                          {b.primary_category}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={dashboardHref}
                      className={cn(btnPrimary, "h-8 px-3 text-xs")}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={detailHref}
                      className={cn(btnSecondary, "h-8 px-3 text-xs")}
                    >
                      Details
                    </Link>
                    <RowOverflowLinks businessId={b.id} />
                    {mode === "prospects" && !b.archived_at ? (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void convertToClient(b.id)}
                        className={cn(btnSecondary, "h-8 px-3 text-xs disabled:opacity-50")}
                      >
                        {busyId === b.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        Convert
                      </button>
                    ) : null}
                    {mode === "clients" && clientFilter === "active" ? (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void archiveClient(b.id)}
                        className={cn(btnSecondary, "ml-auto h-8 px-3 text-xs disabled:opacity-50")}
                      >
                        {busyId === b.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                        Archive
                      </button>
                    ) : null}
                    {mode === "clients" && clientFilter === "archived" ? (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void restoreClient(b.id)}
                        className={cn(btnSecondary, "ml-auto h-8 px-3 text-xs disabled:opacity-50")}
                      >
                        {busyId === b.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Restore
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <ClientPager page={currentPage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </div>
      )}
    </ModulePage>
  );
}

function RowOverflowLinks({ businessId }: { businessId: string }) {
  return (
    <details className="relative">
      <summary
        className={cn(
          btnSecondary,
          "h-8 cursor-pointer list-none px-2.5 text-xs [&::-webkit-details-marker]:hidden"
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        More
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-xs shadow-lg">
        <Link
          href={`/businesses/${businessId}/scans`}
          className="block px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Scans
        </Link>
        <Link
          href={`/businesses/${businessId}/reports`}
          className="block px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Reports
        </Link>
      </div>
    </details>
  );
}

const COLUMN_THEME: Record<
  ProspectPipelineStatus,
  { bar: string; soft: string; chip: string; dot: string }
> = {
  new: {
    bar: "bg-sky-500",
    soft: "bg-sky-50/70",
    chip: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
  },
  contacted: {
    bar: "bg-indigo-500",
    soft: "bg-indigo-50/70",
    chip: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
  },
  audit_sent: {
    bar: "bg-violet-500",
    soft: "bg-violet-50/70",
    chip: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
  },
  proposal_sent: {
    bar: "bg-amber-500",
    soft: "bg-amber-50/70",
    chip: "bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
  },
  won: {
    bar: "bg-emerald-500",
    soft: "bg-emerald-50/70",
    chip: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  lost: {
    bar: "bg-rose-500",
    soft: "bg-rose-50/60",
    chip: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
  },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function ProspectKanban({
  columns,
  busyId,
  draggingId,
  onDragStart,
  onDragEnd,
  onMove,
  onConvert,
}: {
  columns: Record<ProspectPipelineStatus, AccountListRow[]>;
  busyId: string | null;
  draggingId: string | null;
  onDragStart: (businessId: string) => void;
  onDragEnd: () => void;
  onMove: (businessId: string, status: ProspectPipelineStatus) => void;
  onConvert: (businessId: string) => void;
}) {
  function handleDrop(
    event: DragEvent<HTMLElement>,
    status: ProspectPipelineStatus
  ) {
    event.preventDefault();
    const businessId = event.dataTransfer.getData("text/plain") || draggingId;
    if (businessId) onMove(businessId, status);
  }

  const total = PROSPECT_PIPELINE_STATUSES.reduce(
    (sum, status) => sum + columns[status].length,
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white px-3.5 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Pipeline
        </span>
        <span className="text-[12px] font-medium text-zinc-700">{total} prospects</span>
        <span className="h-4 w-px bg-zinc-200" />
        {PROSPECT_PIPELINE_STATUSES.map((status) => {
          const theme = COLUMN_THEME[status];
          const count = columns[status].length;
          return (
            <span
              key={status}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                theme.chip
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", theme.dot)} />
              {statusLabel(status)}
              <span className="tabular-nums opacity-80">{count}</span>
            </span>
          );
        })}
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[1180px] grid-cols-6 gap-3">
          {PROSPECT_PIPELINE_STATUSES.map((status) => {
            const prospects = columns[status];
            const theme = COLUMN_THEME[status];
            const isDropTarget = Boolean(draggingId);
            return (
              <section
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, status)}
                className={cn(
                  "flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition",
                  theme.soft,
                  isDropTarget && "ring-2 ring-emerald-300/70 ring-offset-1"
                )}
              >
                <div className={cn("h-1 w-full", theme.bar)} />
                <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-semibold text-zinc-900">
                      {statusLabel(status)}
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      {prospects.length === 0
                        ? "Empty stage"
                        : `${prospects.length} in stage`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-bold tabular-nums",
                      theme.chip
                    )}
                  >
                    {prospects.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2 px-2 pb-2">
                  {prospects.length === 0 ? (
                    <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300/80 bg-white/70 px-3 text-center">
                      <GripVertical className="mb-1 h-4 w-4 text-zinc-300" />
                      <p className="text-[11px] font-medium text-zinc-500">Drop here</p>
                    </div>
                  ) : (
                    <ShowMoreList
                      items={prospects}
                      renderItem={(item) => {
                        const prospect = item as AccountListRow;
                        return (
                          <ProspectCard
                            key={prospect.id}
                            prospect={prospect}
                            busy={busyId === prospect.id}
                            dragging={draggingId === prospect.id}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onMove={onMove}
                            onConvert={onConvert}
                          />
                        );
                      }}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  busy,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onConvert,
}: {
  prospect: AccountListRow;
  busy: boolean;
  dragging: boolean;
  onDragStart: (businessId: string) => void;
  onDragEnd: () => void;
  onMove: (businessId: string, status: ProspectPipelineStatus) => void;
  onConvert: (businessId: string) => void;
}) {
  const status = prospectPipelineStatus(prospect.prospect_status);
  const nextStatus = nextPipelineStatus(status);
  const theme = COLUMN_THEME[status];

  return (
    <article
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", prospect.id);
        onDragStart(prospect.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-xl border border-white bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition",
        "hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)]",
        dragging && "opacity-60 ring-2 ring-emerald-400",
        busy && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm",
            theme.bar
          )}
        >
          {initials(prospect.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/prospects/${prospect.id}`}
            className="block truncate text-[13px] font-semibold text-zinc-900 hover:text-emerald-700"
          >
            {prospect.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500">
            <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
            <span className="truncate">{locationSubtitle(prospect)}</span>
          </p>
        </div>
        <span
          className="mt-0.5 cursor-grab rounded-md p-1 text-zinc-300 opacity-0 transition group-hover:opacity-100"
          title="Drag to move"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {prospect.primary_category ? (
          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
            {prospect.primary_category}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            No category
          </span>
        )}
        {prospect.created_at ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            <Calendar className="h-3 w-3" />
            {new Date(prospect.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : null}
      </div>

      {(prospect.primary_contact_name || prospect.primary_contact_email) && (
        <div className="mt-2.5 rounded-lg bg-zinc-50 px-2.5 py-2">
          <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-zinc-700">
            <User className="h-3 w-3 text-zinc-400" />
            {prospect.primary_contact_name || "Contact"}
          </p>
          {prospect.primary_contact_email ? (
            <p className="mt-0.5 truncate pl-4 text-[10px] text-zinc-500">
              {prospect.primary_contact_email}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <Link
          href={`/prospects/${prospect.id}?audit=1`}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <Radar className="h-3.5 w-3.5" />
          Audit
        </Link>
        <Link
          href={`/businesses/${prospect.id}/reports?type=single_scan&scope=prospect`}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <FileText className="h-3.5 w-3.5" />
          Report
        </Link>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <select
          value={status}
          disabled={busy}
          onChange={(event) =>
            onMove(prospect.id, event.target.value as ProspectPipelineStatus)
          }
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium capitalize text-zinc-700 disabled:opacity-50"
          aria-label={`Move ${prospect.name} to status`}
        >
          {PROSPECT_PIPELINE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {statusLabel(option)}
            </option>
          ))}
        </select>
        {nextStatus ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMove(prospect.id, nextStatus)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            title={`Move to ${statusLabel(nextStatus)}`}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onConvert(prospect.id)}
        className="mt-1.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-2 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(19,119,82,0.25)] hover:bg-[#0f6344] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
        Convert to client
      </button>
    </article>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold capitalize text-white shadow-sm"
          : "rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium capitalize text-zinc-600 hover:bg-zinc-50"
      }
    >
      {label}
    </button>
  );
}
