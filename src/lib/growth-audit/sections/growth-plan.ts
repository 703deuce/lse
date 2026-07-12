import { buildActionPlanFromAudits } from "@/lib/audit/action-plan-engine";
import type { ActionTask, AuditCheck, GbpProfile } from "@/lib/audit/types";
import type { CategoryGapResult } from "@/lib/audit/category-gap";
import type { Core30Result } from "@/lib/audit/core30";
import type { CompetitorGapResult } from "@/lib/audit/competitor-gap";
import type { HyperLocalOpportunity } from "@/lib/audit/hyperlocal";
import type { ServiceCoverageAuditResult } from "@/lib/audit/service-coverage";
import type { GrowthPlanSection, GrowthTask } from "@/lib/growth-audit/types";

function effortToDifficulty(effort: ActionTask["effort"]): GrowthTask["difficulty"] {
  if (effort === "low") return "easy";
  if (effort === "high") return "hard";
  return "medium";
}

function effortToTime(effort: ActionTask["effort"], impact: ActionTask["impact"]): string {
  if (effort === "low" && impact !== "high") return "5 minutes";
  if (effort === "low") return "15 minutes";
  if (effort === "medium") return "30–45 minutes";
  return "1–2 hours";
}

function impactToStars(impact: ActionTask["impact"]): number {
  if (impact === "high") return 5;
  if (impact === "medium") return 3;
  return 2;
}

function timeframeToPriority(timeframe: ActionTask["timeframe"]): GrowthTask["priority"] {
  if (timeframe === "urgent") return "high";
  if (timeframe === "30-day") return "low";
  return "medium";
}

function toGrowthTask(task: ActionTask): GrowthTask {
  const sectionMap: Record<string, string> = {
    "website-match": "website",
    "category-gap": "service-coverage",
    "service-coverage": "service-coverage",
    core30: "service-coverage",
    hyperlocal: "local-coverage",
    "competitor-gaps": "competitor-gap",
    "gbp-audit": "gbp",
  };
  return {
    ...task,
    priority: timeframeToPriority(task.timeframe),
    impactStars: impactToStars(task.impact),
    difficulty: effortToDifficulty(task.effort),
    timeEstimate: effortToTime(task.effort, task.impact),
    sourceSection: sectionMap[task.module] ?? task.module,
  };
}

function dedupeTasks(tasks: GrowthTask[]): GrowthTask[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const key = t.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGrowthPlanSection(input: {
  gbp: GbpProfile;
  websiteChecks: AuditCheck[];
  categoryGap: CategoryGapResult;
  core30: Core30Result;
  hyperlocal: HyperLocalOpportunity[];
  competitorGap: CompetitorGapResult;
  serviceKeywords?: ServiceCoverageAuditResult;
}): GrowthPlanSection {
  const plan = buildActionPlanFromAudits(input);
  const all = dedupeTasks(plan.all.map(toGrowthTask)).sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    const diff = prio[a.priority] - prio[b.priority];
    if (diff !== 0) return diff;
    return b.impactStars - a.impactStars;
  });

  return {
    tasks: all,
    urgent: all.filter((t) => t.priority === "high").slice(0, 5),
    sevenDay: all.filter((t) => t.priority === "medium").slice(0, 7),
    thirtyDay: all.filter((t) => t.priority === "low").slice(0, 10),
  };
}
