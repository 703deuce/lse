"use client";

import { useMemo, useState, Fragment } from "react";
import {
  Target,
  Flame,
  Zap,
  Clock,
  GripVertical,
  Sparkles,
  ChevronRight,
  Bell,
  FileText,
  Plus,
  MessageSquare,
  Zap as QuickWinIcon,
  User,
  Link2,
  Globe,
} from "lucide-react";
import {
  DifficultyTag,
  FilterPills,
  GaCard,
  GaLink,
  ImpactStars,
  PriorityTag,
  SummaryStatCard,
} from "@/components/growth-audit/growth-audit-ui";
import { Sparkline } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";
import type { GrowthAuditSections, GrowthTask } from "@/lib/growth-audit/types";

const CATEGORY_META: Record<string, { label: string; icon: typeof Target }> = {
  "service-coverage": { label: "Quick Wins", icon: QuickWinIcon },
  gbp: { label: "Profile Fixes", icon: User },
  website: { label: "Website Alignment", icon: Link2 },
  "local-coverage": { label: "Coverage Expansion", icon: Globe },
  "competitor-gap": { label: "Competitive Actions", icon: Target },
};

const TASK_ICONS = [Bell, FileText, Plus, MessageSquare];

function parseMinutes(time: string): number {
  const nums = (time.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return 30;
  const isHours = /hour/i.test(time);
  if (nums.length >= 2 && /[–-]/.test(time)) {
    const avg = (nums[0] + nums[1]) / 2;
    return isHours ? Math.round(avg * 60) : Math.round(avg);
  }
  return isHours ? nums[0] * 60 : nums[0];
}

function formatTotalTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function groupTasks(tasks: GrowthTask[]) {
  const groups: Record<string, GrowthTask[]> = {};
  for (const t of tasks) {
    const key = CATEGORY_META[t.sourceSection]?.label ?? "Other Actions";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  const order = ["Quick Wins", "Profile Fixes", "Website Alignment", "Coverage Expansion", "Competitive Actions", "Other Actions"];
  return order
    .filter((k) => groups[k]?.length)
    .map((k) => ({
      label: k,
      icon: Object.values(CATEGORY_META).find((m) => m.label === k)?.icon ?? Target,
      tasks: groups[k],
    }));
}

export function GrowthAuditActionPlanTab({
  sections,
  onGoToOverview,
}: {
  sections: GrowthAuditSections;
  onGoToOverview?: () => void;
}) {
  const { growthPlan, gbp, website } = sections;
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<GrowthTask | null>(growthPlan.tasks[0] ?? null);

  const filtered = useMemo(() => {
    return growthPlan.tasks.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (bucketFilter !== "all" && t.bucket !== bucketFilter) return false;
      return true;
    });
  }, [growthPlan.tasks, priorityFilter, bucketFilter]);

  const groups = groupTasks(filtered);
  const highCount = growthPlan.tasks.filter((t) => t.priority === "high").length;
  const quickWins = growthPlan.tasks.filter((t) => parseMinutes(t.timeEstimate) <= 30).length;
  const totalMinutes = growthPlan.tasks.reduce((acc, t) => acc + parseMinutes(t.timeEstimate), 0);

  const topTask = selectedTask ?? growthPlan.tasks[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStatCard
          icon={Target}
          iconClassName="bg-emerald-50 text-emerald-600"
          label="Total Opportunities"
          value={growthPlan.tasks.length}
          sub="High-impact actions"
        />
        <SummaryStatCard
          icon={Flame}
          iconClassName="bg-red-50 text-red-600"
          label="High Priority"
          value={highCount}
          sub="Do first"
        />
        <SummaryStatCard
          icon={Zap}
          iconClassName="bg-amber-50 text-amber-600"
          label="Quick Wins"
          value={quickWins}
          sub="< 30 minutes"
        />
        <SummaryStatCard
          icon={Clock}
          iconClassName="bg-blue-50 text-blue-600"
          label="Est. Implementation Time"
          value={formatTotalTime(totalMinutes)}
          sub="Total time"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <GaCard className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-4">
            <FilterPills
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { id: "all", label: "Priority: All" },
                { id: "high", label: "High" },
                { id: "medium", label: "Medium" },
                { id: "low", label: "Low" },
              ]}
            />
            <FilterPills
              value={bucketFilter}
              onChange={setBucketFilter}
              options={[
                { id: "all", label: "Bucket: All" },
                { id: "relevance", label: "Relevance" },
                { id: "trust", label: "Trust" },
                { id: "prominence", label: "Prominence" },
                { id: "distance", label: "Distance" },
              ]}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">Why it matters</th>
                  <th className="px-3 py-2.5">Impact</th>
                  <th className="px-3 py-2.5">Difficulty</th>
                  <th className="px-3 py-2.5">Est. Time</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <Fragment key={group.label}>
                      <tr className="bg-zinc-50/60">
                        <td colSpan={8} className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <GroupIcon className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-xs font-semibold text-zinc-700">
                              {group.label} ({group.tasks.length})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.tasks.map((task, i) => {
                        const Icon = TASK_ICONS[i % TASK_ICONS.length];
                        const active = topTask?.title === task.title;
                        return (
                          <tr
                            key={`${task.title}-${i}`}
                            onClick={() => setSelectedTask(task)}
                            className={cn(
                              "cursor-pointer border-b border-zinc-50 transition hover:bg-zinc-50/80",
                              active && "bg-emerald-50/40"
                            )}
                          >
                            <td className="px-3 py-3">
                              <GripVertical className="h-4 w-4 text-zinc-300" />
                            </td>
                            <td className="px-3 py-3">
                              <PriorityTag priority={task.priority} />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-50 text-zinc-500">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="font-medium text-zinc-900">{task.title}</span>
                              </div>
                            </td>
                            <td className="max-w-[200px] px-3 py-3 text-xs text-zinc-500">{task.why}</td>
                            <td className="px-3 py-3">
                              <ImpactStars count={task.impactStars} />
                            </td>
                            <td className="px-3 py-3">
                              <DifficultyTag difficulty={task.difficulty} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-600">{task.timeEstimate}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                                <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300" />
                                Not Started
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GaCard>

        {topTask && (
          <GaCard className="h-fit xl:sticky xl:top-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-zinc-900">Next best action</p>
            </div>
            <div className="mt-4 flex items-start gap-2">
              <p className="flex-1 text-base font-bold leading-snug text-zinc-900">{topTask.title}</p>
              <PriorityTag priority={topTask.priority} />
            </div>
            <p className="mt-2 text-sm text-zinc-600">{topTask.description}</p>
            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start Now
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] font-medium uppercase text-zinc-400">Est. Time</p>
                <p className="text-sm font-semibold text-zinc-900">{topTask.timeEstimate}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-zinc-400">Difficulty</p>
                <DifficultyTag difficulty={topTask.difficulty} />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-zinc-400">Impact</p>
                <ImpactStars count={topTask.impactStars} className="justify-center" />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold text-emerald-900">Why this first?</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">{topTask.why}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-zinc-100 bg-white p-3">
                <p className="text-[10px] font-medium text-zinc-500">Position Lift</p>
                <p className="text-sm font-bold text-emerald-700">+12</p>
                <Sparkline data={[2, 5, 8, 12]} color="#059669" width={80} height={24} />
              </div>
              <div className="rounded-lg border border-zinc-100 bg-white p-3">
                <p className="text-[10px] font-medium text-zinc-500">More Clicks</p>
                <p className="text-sm font-bold text-emerald-700">+18%</p>
                <Sparkline data={[4, 8, 12, 18]} color="#059669" width={80} height={24} />
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold text-zinc-900">Success Checklist</p>
              <ul className="mt-2 space-y-2">
                {[
                  "Add regular business hours",
                  "Set special hours for holidays",
                  "Verify hours on website",
                  "Confirm hours display on Maps",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className="h-3.5 w-3.5 rounded border border-zinc-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <p className="text-xs font-semibold text-zinc-900">Related Insights</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                <li>GBP Profile Score: {gbp.score}/100</li>
                <li>Website Match: {website.score}/100</li>
              </ul>
              {onGoToOverview && (
                <div className="mt-3">
                  <GaLink onClick={onGoToOverview}>View Full Overview</GaLink>
                </div>
              )}
            </div>
          </GaCard>
        )}
      </div>
    </div>
  );
}
