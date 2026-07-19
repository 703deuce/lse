"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { TrustFilterPill, trustImpactBadge, trustPriorityBadge } from "@/components/local-trust/local-trust-ui";
import { dashboardCard, dashboardCardTitle } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type TaskRow = Record<string, unknown>;

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    open: "bg-zinc-100 text-zinc-600",
    in_progress: "bg-blue-50 text-blue-700",
    complete: "bg-emerald-50 text-emerald-700",
  };
  const label =
    status === "in_progress" ? "In Progress" : status === "complete" ? "Complete" : "Not Started";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", colors[status] ?? colors.open)}>
      {label}
    </span>
  );
}

function progressPct(status: string, index: number) {
  if (status === "complete") return 100;
  if (status === "in_progress") return 40 + (index % 3) * 15;
  return 0;
}

export function LocalTrustTasksTab({
  tasks,
  businessId,
  runId,
  onTasksCreated,
}: {
  tasks: TaskRow[];
  businessId?: string;
  runId?: string | null;
  onTasksCreated?: () => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== "all" && String(t.priority) !== priorityFilter) return false;
      if (statusFilter !== "all" && String(t.status ?? "open") !== statusFilter) return false;
      return true;
    });
  }, [tasks, priorityFilter, statusFilter]);

  const openTasks = filtered.filter((t) => String(t.status ?? "open") !== "complete").slice(0, 5);
  const completed = filtered.filter((t) => t.status === "complete");
  const highImpact = filtered.filter((t) => t.impact === "high" || t.priority === "high");

  async function createTasksFromRun() {
    if (!businessId || !runId) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/trust/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, runId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to create tasks");
      setCreateMsg(`Created ${json.created ?? 0} tasks`);
      onTasksCreated?.();
    } catch (e) {
      setCreateMsg(e instanceof Error ? e.message : "Failed to create tasks");
    } finally {
      setCreating(false);
    }
  }

  if (!tasks.length) {
    return (
      <div className={cn(dashboardCard, "px-3.5 py-8 text-center")}>
        <p className="text-[13px] text-zinc-500">
          No tasks yet. Run the finder, then create tasks from the opportunities.
        </p>
        {businessId && runId ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => void createTasksFromRun()}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create tasks from findings"}
          </button>
        ) : null}
        {createMsg ? <p className="mt-2 text-[12px] text-zinc-500">{createMsg}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-3">
          <TrustFilterPill
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: "all", label: "All" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <TrustFilterPill
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Not Started" },
              { value: "in_progress", label: "In Progress" },
              { value: "complete", label: "Complete" },
            ]}
          />
          {(priorityFilter !== "all" || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setPriorityFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <h3 className="text-[13px] font-semibold text-zinc-900">All Tasks ({filtered.length})</h3>

        <div className="space-y-2">
          {filtered.map((t, i) => {
            const status = String(t.status ?? "open");
            const pct = progressPct(status, i);
            return (
              <div key={String(t.id ?? i)} className={cn(dashboardCard, "p-3")}>
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                      t.priority === "high"
                        ? "bg-red-500"
                        : t.priority === "medium"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    )}
                  >
                    {String(t.title).charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-zinc-900">{String(t.title)}</p>
                      {trustPriorityBadge(String(t.priority ?? "medium"))}
                    </div>
                    {t.description != null && (
                      <p className="mt-0.5 text-[12px] text-zinc-500">{String(t.description)}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      Next step:{" "}
                      {String(t.suggested_action ?? t.description ?? "Review opportunity details")}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Impact</p>
                        {trustImpactBadge(String(t.impact ?? "medium"))}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Effort</p>
                        {trustImpactBadge(String(t.effort ?? "medium"))}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Status</p>
                        {statusBadge(status)}
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <SidebarCard title="Open tasks">
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <li key={String(t.id)} className="truncate text-sm text-zinc-700">
                {String(t.title)}
              </li>
            ))}
            {openTasks.length === 0 && (
              <li className="text-[12px] text-zinc-400">No open tasks</li>
            )}
          </ul>
        </SidebarCard>

        <SidebarCard title="Completed">
          <p className="text-base font-bold text-zinc-900">{completed.length}</p>
          <ul className="mt-3 space-y-2">
            {completed.slice(0, 3).map((t) => (
              <li key={String(t.id)} className="truncate text-sm text-zinc-600">
                {String(t.title)}
              </li>
            ))}
          </ul>
        </SidebarCard>

        <SidebarCard title="High-impact">
          <ul className="space-y-2">
            {highImpact.slice(0, 3).map((t) => (
              <li key={String(t.id)} className="truncate text-sm text-zinc-700">
                {String(t.title)}
              </li>
            ))}
            {highImpact.length === 0 && (
              <li className="text-[12px] text-zinc-400">None yet</li>
            )}
          </ul>
        </SidebarCard>
      </div>
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn(dashboardCard, "p-3")}>
      <h4 className={cn(dashboardCardTitle, "mb-2.5")}>{title}</h4>
      {children}
    </div>
  );
}
