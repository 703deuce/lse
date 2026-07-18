/**
 * Freelancer plan limit shape (usage enforcement target).
 * Maps UI never shows scan-credit anxiety; these control capacity.
 */
export interface PlanLimits {
  maxActiveLocations: number;
  maxConcurrentScans: number;
  maxGridSize: number;
  allowedScheduleFrequencies: Array<"manual" | "weekly" | "biweekly" | "monthly">;
  historyRetentionMonths: number;
  aiVisibilityRunsPerMonth: number | null;
}

/** Suggested freelancer tiers — wire to billing later; enforce soft defaults now. */
export const FREELANCER_PLAN_LIMITS = {
  solo_starter: {
    maxActiveLocations: 5,
    maxConcurrentScans: 1,
    maxGridSize: 9,
    allowedScheduleFrequencies: ["manual"],
    historyRetentionMonths: 6,
    aiVisibilityRunsPerMonth: 20,
  },
  freelancer: {
    maxActiveLocations: 20,
    maxConcurrentScans: 3,
    maxGridSize: 13,
    allowedScheduleFrequencies: ["manual", "weekly", "biweekly", "monthly"],
    historyRetentionMonths: 24,
    aiVisibilityRunsPerMonth: 100,
  },
} as const satisfies Record<string, PlanLimits>;
