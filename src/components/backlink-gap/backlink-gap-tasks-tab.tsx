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
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { gapControl, priorityBadge } from "@/components/backlink-gap/backlink-gap-ui";
import { mock } from "@/components/mockup/ui";

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

function impactBars(impact: string) {
  const level = impact === "high" ? 3 : impact === "medium" ? 2 : 1;
  const color = impact === "high" ? "bg-[#137752]" : impact === "medium" ? "bg-[#F79009]" : "bg-[#98A2B3]";
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("w-1 rounded-sm", n <= level ? color : "bg-[#E4E7EC]")}
          style={{ height: `${n * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

function effortDisplay(effort: string) {
  const color =
    effort === "low" ? "bg-[#137752]" : effort === "medium" ? "bg-[#F79009]" : "bg-[#F04438]";
  const time = effort === "low" ? "1-2 hrs" : effort === "medium" ? "2-4 hrs" : "4+ hrs";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <div>
        <p className="text-xs capitalize text-[#101828]">{effort}</p>
        <p className="text-[10px] text-[#667085]">{time}</p>
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
        <p className="text-xs text-[#101828]">{label}</p>
        <p className="text-[10px] text-[#667085]">{score}/100</p>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: "bg-[#ECFDF3] text-[#027A48] ring-1 ring-[#A6F4C5]",
    in_progress: "bg-[#EFF8FF] text-[#175CD3] ring-1 ring-[#B2DDFF]",
    done: "bg-[#F2F4F7] text-[#475467] ring-1 ring-[#E4E7EC]",
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
      iconClass: "bg-[#ECFDF3] text-[#137752]",
    },
    {
      label: "High Priority",
      value: counts.high,
      sub: "Act on first",
      icon: AlertTriangle,
      iconClass: "bg-[#FEF3F2] text-[#B42318]",
    },
    {
      label: "In Progress",
      value: counts.in_progress,
      sub: "Currently active",
      icon: Briefcase,
      iconClass: "bg-[#FFFAEB] text-[#B54708]",
    },
    {
      label: "Completed",
      value: counts.done,
      sub: "Finished tasks",
      icon: CheckCircle2,
      iconClass: "bg-[#ECFDF3] text-[#137752]",
    },
    {
      label: "Estimated Impact",
      value: "High",
      sub: "Strong potential value",
      icon: TrendingUp,
      iconClass: "bg-[#ECFDF3] text-[#137752]",
    },
  ];

  if (tasks.length === 0) {
    return (
      <div className={cn(mock.card, "border-dashed px-4 py-10 text-center")}>
        <p className="text-sm text-[#667085]">No tasks yet. Run analysis or click Create Tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={cn(mock.card, "flex h-full flex-col p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={mock.label}>{card.label}</p>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", card.iconClass)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {card.value}
              </p>
              <p className="mt-1.5 text-xs text-[#667085]">{card.sub}</p>
            </div>
          );
        })}
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
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                filter === f.id
                  ? "border-[#137752] bg-[#137752] text-white"
                  : "border-[#E6EAF0] bg-white text-[#667085] hover:bg-[#F9FAFB]"
              )}
            >
              {f.label} {f.id === "all" ? counts.all : counts[f.id as keyof typeof counts]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={cn(gapControl, "font-semibold text-[#475467]")}>
            Filters
          </button>
          <select className={cn(gapControl, "text-[#475467]")}>
            <option>Sort: Priority</option>
          </select>
          <div className="flex rounded-lg border border-[#E6EAF0] p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-md p-1.5",
                view === "grid" ? "bg-[#ECFDF3] text-[#137752]" : "text-[#98A2B3]"
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
                view === "list" ? "bg-[#ECFDF3] text-[#137752]" : "text-[#98A2B3]"
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn(mock.card, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={mock.tableHead}>
              <tr>
                <th className="px-4 py-2.5">
                  <input type="checkbox" className="rounded border-[#D0D5DD]" aria-label="Select all" />
                </th>
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Impact</th>
                <th className="px-4 py-2.5">Effort</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {paged.map((task, idx) => {
                const TaskIcon = TASK_ICONS[(page - 1) * pageSize + idx] ?? Globe;
                return (
                  <tr key={task.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-[#D0D5DD]"
                        aria-label={`Select ${task.title}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]">
                          <TaskIcon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-[#101828]">{task.title}</p>
                          {task.description && (
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-[#667085]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{impactDisplay(String(task.impact ?? "medium"))}</td>
                    <td className="px-4 py-3">{effortDisplay(String(task.effort ?? "medium"))}</td>
                    <td className="px-4 py-3">{priorityBadge(String(task.priority ?? "medium"))}</td>
                    <td className="px-4 py-3 text-xs text-[#98A2B3]">Unassigned</td>
                    <td className="px-4 py-3 text-xs text-[#98A2B3]">—</td>
                    <td className="px-4 py-3">{statusBadge(String(task.status ?? "open"))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F4F7] px-4 py-3 text-[12px] text-[#667085]">
          <span>
            Showing {from} to {to} of {filtered.length} tasks
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#E6EAF0] px-2 py-1 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={cn(
                  "min-w-[28px] rounded-lg px-2 py-1 tabular-nums",
                  page === n
                    ? "border border-[#137752] bg-[#ECFDF3] font-semibold text-[#137752]"
                    : "text-[#667085] hover:bg-[#F9FAFB]"
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#E6EAF0] px-2 py-1 disabled:opacity-40"
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
              className={gapControl}
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
