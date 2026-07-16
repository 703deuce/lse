import type { AiEngine } from "@/lib/ai-visibility/types";
import { DEFAULT_ENGINES } from "@/lib/ai-visibility/types";

export type PlanTier = "free" | "starter" | "pro" | "professional" | "agency";

export type PlanLimits = {
  activePrompts: number;
  engines: AiEngine[];
  schedule: "weekly" | "daily" | "custom";
};

const LIMITS: Record<string, PlanLimits> = {
  free: { activePrompts: 1, engines: DEFAULT_ENGINES, schedule: "weekly" },
  starter: { activePrompts: 1, engines: DEFAULT_ENGINES, schedule: "weekly" },
  pro: { activePrompts: 5, engines: DEFAULT_ENGINES, schedule: "daily" },
  professional: { activePrompts: 5, engines: DEFAULT_ENGINES, schedule: "daily" },
  agency: { activePrompts: 25, engines: DEFAULT_ENGINES, schedule: "custom" },
  internal: { activePrompts: 9999, engines: DEFAULT_ENGINES, schedule: "custom" },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const key = (plan ?? "starter").toLowerCase();
  return LIMITS[key] ?? LIMITS.starter;
}

export function priorityToScore(priority: string): number {
  if (priority === "High") return 5;
  if (priority === "Medium") return 3;
  return 1;
}

export function scoreToStars(score: number): string {
  const stars = Math.max(1, Math.min(5, score));
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
