"use client";

import {
  Bell,
  FileText,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import {
  GaCard,
  GaLink,
  ImpactStars,
  PriorityTag,
} from "@/components/growth-audit/growth-audit-ui";
import {
  btnPrimary,
  HeroPanel,
  MetricStrip,
  heroMetricClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { GrowthAuditSections } from "@/lib/growth-audit/types";

const TASK_ICONS = [Bell, FileText, Plus, MessageSquare];

export function GrowthAuditOverviewTab({
  sections,
  growthScore,
  onGoToActionPlan,
}: {
  businessId: string;
  sections: GrowthAuditSections;
  growthScore: number;
  onGoToActionPlan: () => void;
}) {
  const coverageScore = Math.round(
    (sections.serviceCoverage.score + sections.localCoverage.score) / 2
  );

  const topTasks = sections.growthPlan.tasks.slice(0, 6);

  return (
    <div className="space-y-4">
      <HeroPanel
        eyebrow="Growth audit"
        title="Overall audit score"
        description="Composite readiness across GBP, website, coverage, and competitive position."
        metric={
          <span className={heroMetricClass}>
            {growthScore}
            <span className="ml-1 text-xl font-medium text-zinc-400">/100</span>
          </span>
        }
        actions={
          <button
            type="button"
            onClick={onGoToActionPlan}
            className={btnPrimary}
          >
            View action plan
          </button>
        }
      />
      <MetricStrip
        items={[
          { label: "GBP score", value: String(sections.gbp.score) },
          { label: "Website match", value: String(sections.website.score) },
          { label: "Coverage", value: String(coverageScore) },
          { label: "Competitive position", value: String(sections.competitorGap.score) },
        ]}
      />

      <section>
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              Top opportunities
            </h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Highest-impact actions from this audit.
            </p>
          </div>
          <GaLink onClick={onGoToActionPlan}>View Full Action Plan</GaLink>
        </div>
        <GaCard className="!p-0 overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {topTasks.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[13px] text-zinc-500">
                No prioritized tasks yet — open the Action Plan tab after the audit finishes.
              </p>
            ) : (
              topTasks.map((task, i) => {
                const Icon = TASK_ICONS[i % TASK_ICONS.length];
                return (
                  <button
                    key={`${task.title}-${i}`}
                    type="button"
                    onClick={onGoToActionPlan}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50"
                  >
                    <PriorityTag priority={task.priority} />
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-[#137752]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900">{task.title}</p>
                      {task.description ? (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {task.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 sm:flex">
                      <div className="text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                          Impact
                        </p>
                        <ImpactStars count={task.impactStars} />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                          Difficulty
                        </p>
                        <p
                          className={cn(
                            "text-[11px] font-medium capitalize",
                            task.difficulty === "easy" ? "text-emerald-600" : "text-amber-600"
                          )}
                        >
                          {task.difficulty}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                );
              })
            )}
          </div>
          {sections.growthPlan.tasks.length > 6 ? (
            <div className="border-t border-zinc-100 px-3.5 py-2 text-center">
              <button
                type="button"
                onClick={onGoToActionPlan}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                View all {sections.growthPlan.tasks.length} tasks
              </button>
            </div>
          ) : null}
        </GaCard>
      </section>
    </div>
  );
}
