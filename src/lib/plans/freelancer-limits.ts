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
    // One at a time — parallel scans from the same book confuse schedules and burn credits.
    maxConcurrentScans: 1,
    maxGridSize: 13,
    allowedScheduleFrequencies: ["manual", "weekly", "biweekly", "monthly"],
    historyRetentionMonths: 24,
    aiVisibilityRunsPerMonth: 100,
  },
  /** Platform admin / internal testing — highest capacity. */
  internal: {
    maxActiveLocations: 9999,
    maxConcurrentScans: 25,
    maxGridSize: 13,
    allowedScheduleFrequencies: ["manual", "weekly", "biweekly", "monthly"],
    historyRetentionMonths: 120,
    aiVisibilityRunsPerMonth: null,
  },
} as const satisfies Record<string, PlanLimits>;
