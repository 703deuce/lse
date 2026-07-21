"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  Archive,
  ArrowRight,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Radar,
  RotateCcw,
  UserCheck,
} from "lucide-react";
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

function locationSubtitle(b: AccountListRow): string {
  return b.address_text?.trim() || b.scan_center_label?.trim() || b.primary_category || "—";
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const mockLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    audit_sent: "Sent Map",
    proposal_sent: "Proposal Sent",
    won: "Won",
    lost: "Lost",
    archived: "Archived",
  };
  if (status in mockLabels) return mockLabels[status]!;
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
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold tracking-tight text-[#101828]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">{subtitle}</p>
        </div>
        {mode === "clients" && !canAdd ? (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {trackedCount}/{maxBusinesses} active locations — upgrade to add more
          </span>
        ) : (
          <Link href={newHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white hover:bg-[#0f6244]">
            <Plus className="h-4 w-4" />
            {mode === "prospects" ? "Add Prospect" : newLabel}
          </Link>
        )}
      </div>

      {mode === "clients" ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[#667085]">
          <span className="rounded-md bg-[#F2F4F7] px-2.5 py-1 font-medium text-[#344054]">
            {trackedCount} / {maxBusinesses || "—"} active locations
          </span>
          {planName ? <span>{planName} plan</span> : null}
          <div className="flex gap-2">
            <FilterChip
              active={clientFilter === "active"}
              onClick={() => setClientFilter("active")}
              label="Active"
            />
            <FilterChip
              active={clientFilter === "archived"}
              onClick={() => setClientFilter("archived")}
              label="Archived"
            />
          </div>
        </div>
      ) : (
        <div className="mb-4 space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-[#E6EAF0]">
            {(
              [
                { id: "all", label: "Pipeline View" },
                { id: "table", label: "Table View" },
                { id: "archived", label: "Archived" },
              ] as const
            ).map((tab) => {
              const active =
                tab.id === "archived"
                  ? statusFilter === "archived"
                  : tab.id === "all"
                    ? statusFilter === "all"
                    : false;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === "archived") setStatusFilter("archived");
                    else setStatusFilter("all");
                  }}
                  className={
                    active
                      ? "-mb-px border-b-2 border-[#137752] px-3 pb-2.5 pt-1 text-sm font-semibold text-[#137752]"
                      : "-mb-px border-b-2 border-transparent px-3 pb-2.5 pt-1 text-sm font-semibold text-[#667085] hover:text-[#344054]"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total Prospects", value: activeProspectCount, color: "bg-[#ECFDF3] text-[#137752]" },
              {
                label: "New",
                value: (prospectColumns.new ?? []).length,
                color: "bg-[#EFF8FF] text-[#175CD3]",
              },
              {
                label: "Contacted",
                value: (prospectColumns.contacted ?? []).length,
                color: "bg-[#F4F3FF] text-[#5925DC]",
              },
              {
                label: "Won",
                value: (prospectColumns.won ?? []).length,
                color: "bg-[#FFFAEB] text-[#B54708]",
              },
              {
                label: "Lost",
                value: (prospectColumns.lost ?? []).length,
                color: "bg-[#F2F4F7] text-[#475467]",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${m.color}`}>
                    {m.value}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                      {m.label}
                    </p>
                    <p className="text-xl font-bold tabular-nums text-[#101828]">{m.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-6 py-12 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <MapPin className="mx-auto h-8 w-8 text-zinc-300" />
            <h2 className="mt-3 text-base font-semibold text-zinc-900">{emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{emptyBody}</p>
            <Link
              href={newHref}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344]"
            >
              <Plus className="h-4 w-4" />
              {newLabel}
            </Link>
          </div>
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
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-6 py-12 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <MapPin className="mx-auto h-8 w-8 text-zinc-300" />
          <h2 className="mt-3 text-base font-semibold text-zinc-900">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{emptyBody}</p>
          <Link
            href={newHref}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344]"
          >
            <Plus className="h-4 w-4" />
            {newLabel}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          {list.map((b) => {
            const dashboardHref = `/businesses/${b.id}/overview`;
            const detailHref =
              mode === "prospects" ? `/prospects/${b.id}` : `/clients/${b.id}`;
            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={dashboardHref}
                    className="truncate text-sm font-semibold text-zinc-900 hover:text-emerald-700"
                  >
                    {b.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{locationSubtitle(b)}</p>
                  {mode === "prospects" ? (
                    <p className="mt-1 text-[11px] capitalize text-zinc-400">
                      {statusLabel(b.prospect_status ?? "new")}
                      {b.primary_contact_name ? ` · ${b.primary_contact_name}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={dashboardHref}
                    className="rounded-full bg-[#137752] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0f6344]"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={detailHref}
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Details
                  </Link>
                  <Link
                    href={`/businesses/${b.id}/scans`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Scans
                  </Link>
                  <Link
                    href={`/businesses/${b.id}/reports`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Reports
                  </Link>
                  {mode === "prospects" && !b.archived_at ? (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void convertToClient(b.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
                    >
                      {busyId === b.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      Convert to client
                    </button>
                  ) : null}
                  {mode === "clients" && clientFilter === "active" ? (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void archiveClient(b.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
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
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
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

  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-3">
      <div className="grid min-w-[1120px] grid-cols-6 gap-3">
        {PROSPECT_PIPELINE_STATUSES.map((status) => {
          const prospects = columns[status];
          const accent =
            status === "new"
              ? "bg-[#175CD3]"
              : status === "contacted"
                ? "bg-[#6927DA]"
                : status === "audit_sent"
                  ? "bg-[#137752]"
                  : status === "proposal_sent"
                    ? "bg-[#DC6803]"
                    : status === "won"
                      ? "bg-[#027A48]"
                      : "bg-[#F04438]";
          return (
            <section
              key={status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, status)}
              className="min-h-[360px] rounded-xl border border-[#E6EAF0] bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <div className="mb-2.5 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#344054]">
                  <span className={`h-2 w-2 rounded-full ${accent}`} />
                  {statusLabel(status)}
                </h2>
                <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[11px] font-semibold text-[#667085]">
                  {prospects.length}
                </span>
              </div>

              {prospects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-3 py-8 text-center text-[12px] text-[#98A2B3]">
                  Add Prospects
                </div>
              ) : (
                <div className="space-y-2">
                  {prospects.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      busy={busyId === prospect.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onMove={onMove}
                      onConvert={onConvert}
                    />
                  ))}
                </div>
              )}
              <p className="mt-3 px-1 text-[10px] text-[#98A2B3]">
                {prospects.length} total leads
              </p>
            </section>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#027A48]">
          Move prospects through your pipeline. Drag and drop cards to change statuses and keep track
          of your growth.
        </p>
        <Link href="/prospects" className="text-sm font-semibold text-[#027A48] hover:underline">
          How pipeline works →
        </Link>
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  busy,
  onDragStart,
  onDragEnd,
  onMove,
  onConvert,
}: {
  prospect: AccountListRow;
  busy: boolean;
  onDragStart: (businessId: string) => void;
  onDragEnd: () => void;
  onMove: (businessId: string, status: ProspectPipelineStatus) => void;
  onConvert: (businessId: string) => void;
}) {
  const status = prospectPipelineStatus(prospect.prospect_status);
  const nextStatus = nextPipelineStatus(status);

  return (
    <article
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", prospect.id);
        onDragStart(prospect.id);
      }}
      onDragEnd={onDragEnd}
      className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-emerald-200 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/prospects/${prospect.id}`}
            className="block truncate text-[13px] font-semibold text-zinc-900 hover:text-emerald-700"
          >
            {prospect.name}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {locationSubtitle(prospect)}
          </p>
        </div>
        <span className="cursor-grab rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Drag
        </span>
      </div>

      {prospect.primary_contact_name || prospect.primary_contact_email ? (
        <p className="mt-2 truncate text-[11px] text-zinc-500">
          {prospect.primary_contact_name || prospect.primary_contact_email}
          {prospect.primary_contact_name && prospect.primary_contact_email
            ? ` · ${prospect.primary_contact_email}`
            : ""}
        </p>
      ) : null}

      <div className="mt-3 space-y-1.5">
        <Link
          href={`/businesses/${prospect.id}/scans`}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-2 text-[12px] font-semibold text-white hover:bg-[#0f6244]"
        >
          <Radar className="h-3.5 w-3.5" />
          Generate Scan
        </Link>
        <Link
          href={`/businesses/${prospect.id}/reports?type=single_scan&scope=prospect`}
          className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-[#D0D5DD] px-2 text-[11px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
        >
          <FileText className="h-3 w-3" />
          Go to prospect report
        </Link>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={status}
          disabled={busy}
          onChange={(event) =>
            onMove(prospect.id, event.target.value as ProspectPipelineStatus)
          }
          className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] capitalize text-zinc-700 disabled:opacity-50"
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
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            title={`Move to ${statusLabel(nextStatus)}`}
          >
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onConvert(prospect.id)}
        className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md bg-[#137752] px-2 text-[11px] font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
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
          ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium capitalize text-white"
          : "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium capitalize text-zinc-600 hover:bg-zinc-50"
      }
    >
      {label}
    </button>
  );
}
