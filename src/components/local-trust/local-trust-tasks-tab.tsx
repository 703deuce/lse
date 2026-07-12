"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { TrustFilterPill, trustImpactBadge, trustPriorityBadge } from "@/components/local-trust/local-trust-ui";
import { cn } from "@/lib/utils";

type TaskRow = Record<string, unknown>;

const OWNER_INITIALS = ["JD", "KL", "JS", "AM"];

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    open: "bg-zinc-100 text-zinc-600",
    in_progress: "bg-blue-50 text-blue-700",
    complete: "bg-emerald-50 text-emerald-700",
  };
  const label = status === "in_progress" ? "In Progress" : status === "complete" ? "Complete" : "Not Started";
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

export function LocalTrustTasksTab({ tasks }: { tasks: TaskRow[] }) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== "all" && String(t.priority) !== priorityFilter) return false;
      if (statusFilter !== "all" && String(t.status ?? "open") !== statusFilter) return false;
      return true;
    });
  }, [tasks, priorityFilter, statusFilter]);

  const dueSoon = filtered.slice(0, 3);
  const completed = filtered.filter((t) => t.status === "complete");
  const highImpact = filtered.filter((t) => t.impact === "high");

  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-12 text-center shadow-sm">
        <p className="text-sm text-zinc-500">No tasks yet. Run the finder to generate recommended actions.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-4">
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
          <TrustFilterPill label="Owner" value="all" onChange={() => {}} options={[{ value: "all", label: "All" }]} />
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
          <TrustFilterPill label="Due Date" value="all" onChange={() => {}} options={[{ value: "all", label: "All" }]} />
          <button type="button" className="text-xs font-medium text-emerald-700 hover:underline">
            Clear filters
          </button>
          <div className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Sort: Due Date
          </div>
        </div>

        <h3 className="text-sm font-semibold text-zinc-900">All Tasks ({filtered.length})</h3>

        <div className="space-y-3">
          {filtered.map((t, i) => {
            const status = String(t.status ?? "open");
            const pct = progressPct(status, i);
            const owner = OWNER_INITIALS[i % OWNER_INITIALS.length];
            const dueDate = new Date(Date.now() + (i + 3) * 86400000 * 3);
            return (
              <div
                key={String(t.id ?? i)}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-amber-500" : "bg-blue-500"
                    )}
                  >
                    {String(t.title).charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-900">{String(t.title)}</p>
                      {trustPriorityBadge(String(t.priority ?? "medium"))}
                    </div>
                    {t.description != null && (
                      <p className="mt-1 text-sm text-zinc-500">{String(t.description)}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      Next step: {String(t.suggested_action ?? t.description ?? "Review opportunity details")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Impact</p>
                        {trustImpactBadge(String(t.impact ?? "medium"))}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Effort</p>
                        {trustImpactBadge(String(t.effort ?? "medium"))}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Due Date</p>
                        <p className="flex items-center gap-1 text-xs text-zinc-600">
                          <Calendar className="h-3 w-3" />
                          {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-400">Owner</p>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                          {owner}
                        </span>
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
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-zinc-300" />
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
          View all tasks
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <SidebarCard title="Tasks Due Soon" action="View all">
          <ul className="space-y-2">
            {dueSoon.map((t, i) => (
              <li key={String(t.id)} className="flex items-center justify-between text-sm">
                <span className="truncate text-zinc-700">{String(t.title)}</span>
                <span className="shrink-0 text-xs font-medium text-red-600">
                  {new Date(Date.now() + (i + 2) * 86400000 * 4).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </SidebarCard>

        <SidebarCard title="Completed This Week" action="View all">
          <p className="text-3xl font-bold text-zinc-900">{completed.length}</p>
          <p className="text-xs font-medium text-emerald-600">+{completed.length > 0 ? 100 : 0}% vs last week</p>
          <ul className="mt-3 space-y-2">
            {completed.slice(0, 2).map((t) => (
              <li key={String(t.id)} className="flex items-center gap-2 text-sm text-zinc-600">
                <span className="text-emerald-500">✓</span>
                <span className="truncate">{String(t.title)}</span>
              </li>
            ))}
            {completed.length === 0 && (
              <li className="text-xs text-zinc-400">No completed tasks yet</li>
            )}
          </ul>
        </SidebarCard>

        <SidebarCard title="High-Impact Actions" action="View all">
          <p className="text-3xl font-bold text-zinc-900">{highImpact.length || tasks.filter((t) => t.priority === "high").length}</p>
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
            <Star className="mb-1 inline h-3.5 w-3.5" /> Focus on high-impact tasks to maximize visibility and community trust.
          </div>
        </SidebarCard>
      </div>
    </div>
  );
}

function SidebarCard({
  title,
  action,
  children,
}: {
  title: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
        <button type="button" className="text-xs font-medium text-emerald-700 hover:underline">
          {action}
        </button>
      </div>
      {children}
    </div>
  );
}
