"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Globe,
  Handshake,
  LayoutGrid,
  List,
  MoreHorizontal,
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { priorityBadge } from "@/components/backlink-gap/backlink-gap-ui";
import { dashboardCard, dashboardControl, dashboardMicro } from "@/components/overview/dashboard-ui";
import { GridMetricCard } from "@/components/ui/metric-card";

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  priority?: string;
  impact?: string;
  effort?: string;
  status?: string;
};

const TASK_FILTERS = [
  { id: "all", label: "All Tasks" },
  { id: "open", label: "Recommended" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Completed" },
] as const;

const TASK_ICONS = [Globe, Handshake, Star, ClipboardList, Globe];

const PLACEHOLDER_OWNERS = [
  { initials: "SJ", name: "Sarah Johnson", color: "bg-sky-500" },
  { initials: "MC", name: "Mike Chen", color: "bg-violet-500" },
  { initials: "JD", name: "John Doe", color: "bg-emerald-600" },
];

function impactBars(impact: string) {
  const level = impact === "high" ? 3 : impact === "medium" ? 2 : 1;
  const color = impact === "high" ? "bg-emerald-500" : impact === "medium" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("w-1 rounded-sm", n <= level ? color : "bg-zinc-200")}
          style={{ height: `${n * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

function effortDisplay(effort: string) {
  const color =
    effort === "low" ? "bg-emerald-500" : effort === "medium" ? "bg-amber-400" : "bg-red-400";
  const time = effort === "low" ? "1-2 hrs" : effort === "medium" ? "2-4 hrs" : "4+ hrs";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <div>
        <p className="text-xs capitalize text-zinc-900">{effort}</p>
        <p className="text-[10px] text-zinc-500">{time}</p>
      </div>
    </div>
  );
}

function impactDisplay(impact: string) {
  const score = impact === "high" ? 92 : impact === "medium" ? 68 : 45;
  const label = impact === "high" ? "High" : impact === "medium" ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2">
      {impactBars(impact)}
      <div>
        <p className="text-xs text-zinc-900">{label}</p>
        <p className="text-[10px] text-zinc-500">{score}/100</p>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    in_progress: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    done: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
  };
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    done: "Completed",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", styles[status] ?? styles.open)}>
      {labels[status] ?? status}
    </span>
  );
}

function ownerDisplay(index: number) {
  const owner = PLACEHOLDER_OWNERS[index % PLACEHOLDER_OWNERS.length];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
          owner.color
        )}
      >
        {owner.initials}
      </span>
      <span className="text-xs text-zinc-700">{owner.name}</span>
    </div>
  );
}

function dueDateDisplay(index: number) {
  const daysLeft = [3, 7, 14, 5, 21][index % 5];
  const date = new Date();
  date.setDate(date.getDate() + daysLeft);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div>
      <p className="text-xs text-zinc-900">{formatted}</p>
      <p className="text-[10px] text-red-500">{daysLeft} days left</p>
    </div>
  );
}

export function BacklinkGapTasksTab({ tasks }: { tasks: TaskRow[] }) {
  const [filter, setFilter] = useState<(typeof TASK_FILTERS)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      open: tasks.filter((t) => (t.status ?? "open") === "open").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      high: tasks.filter((t) => t.priority === "high").length,
    }),
    [tasks]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "open") return tasks.filter((t) => (t.status ?? "open") === "open");
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filtered.length);

  const kpiCards = [
    {
      label: "Open Tasks",
      value: counts.open,
      sub: "Require attention",
      icon: ClipboardList,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "High Priority",
      value: counts.high,
      sub: "Act on first",
      icon: AlertTriangle,
      color: "text-red-600 bg-red-50",
    },
    {
      label: "In Progress",
      value: counts.in_progress,
      sub: "Currently active",
      icon: Briefcase,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Completed",
      value: counts.done,
      sub: "Finished tasks",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Estimated Impact",
      value: "High",
      sub: "Strong potential value",
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  if (tasks.length === 0) {
    return (
      <div className={cn(dashboardCard, "border-dashed px-3.5 py-8 text-center text-[13px]")}>
        <p className="text-[13px] text-zinc-500">No tasks yet. Run analysis or click Create Tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <GridMetricCard
            key={card.label}
            compact
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            iconWrapClassName={card.color.split(" ").slice(1).join(" ")}
            iconClassName={card.color.split(" ")[0]}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TASK_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                filter === f.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {f.label} {f.id === "all" ? counts.all : counts[f.id as keyof typeof counts]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cn(dashboardControl, "px-3 text-[12px] font-medium text-zinc-600")}
          >
            Filters
          </button>
          <select className={cn(dashboardControl, "px-3 text-[12px] text-zinc-600")}>
            <option>Sort: Priority</option>
          </select>
          <div className="flex rounded-lg border border-zinc-200 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-md p-1.5",
                view === "grid" ? "bg-emerald-50 text-emerald-700" : "text-zinc-400"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "rounded-md p-1.5",
                view === "list" ? "bg-emerald-50 text-emerald-700" : "text-zinc-400"
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn(dashboardCard, "overflow-hidden p-0")}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox" className="rounded border-zinc-300" aria-label="Select all" />
                </th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Impact</th>
                <th className="px-3 py-2">Effort</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paged.map((task, idx) => {
                const TaskIcon = TASK_ICONS[(page - 1) * pageSize + idx] ?? Globe;
                return (
                  <tr key={task.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300"
                        aria-label={`Select ${task.title}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <TaskIcon className="h-3 w-3" />
                        </span>
                        <div>
                          <p className="font-medium text-zinc-900">{task.title}</p>
                          {task.description && (
                            <p className={`mt-0.5 line-clamp-2 ${dashboardMicro}`}>{task.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{impactDisplay(String(task.impact ?? "medium"))}</td>
                    <td className="px-3 py-2">{effortDisplay(String(task.effort ?? "medium"))}</td>
                    <td className="px-3 py-2">{priorityBadge(String(task.priority ?? "medium"))}</td>
                    <td className="px-3 py-2">{ownerDisplay((page - 1) * pageSize + idx)}</td>
                    <td className="px-3 py-2">{dueDateDisplay((page - 1) * pageSize + idx)}</td>
                    <td className="px-3 py-2">{statusBadge(String(task.status ?? "open"))}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded p-1 hover:bg-zinc-100" aria-label="More actions">
                        <MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-3.5 py-2.5 ${dashboardMicro}`}>
          <span>
            Showing {from} to {to} of {filtered.length} tasks
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={cn(
                  "min-w-[28px] rounded px-2 py-1 tabular-nums",
                  page === n
                    ? "border border-emerald-600 bg-emerald-50 font-semibold text-emerald-700"
                    : "text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-zinc-200 px-2 py-0.5 text-[12px]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
