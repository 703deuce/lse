import type { PlanId } from "@/lib/plans";
import {
  FREELANCER_PLAN_LIMITS,
  type PlanLimits,
} from "@/lib/plans/freelancer-limits";

/** Map existing plan ids onto freelancer capacity limits. */
export function resolveFreelancerLimits(planId: PlanId | string | null | undefined): PlanLimits {
  if (planId === "internal") {
    return { ...FREELANCER_PLAN_LIMITS.internal };
  }
  if (planId === "starter") return { ...FREELANCER_PLAN_LIMITS.solo_starter };
  if (planId === "agency") {
    return {
      ...FREELANCER_PLAN_LIMITS.freelancer,
      maxActiveLocations: 50,
      maxConcurrentScans: 5,
      maxGridSize: 13,
    };
  }
  // pro + default
  return { ...FREELANCER_PLAN_LIMITS.freelancer };
}

export function assertGridSizeAllowed(
  gridSize: number,
  limits: PlanLimits
): { ok: true } | { ok: false; message: string } {
  if (gridSize > limits.maxGridSize) {
    return {
      ok: false,
      message: `Grid size ${gridSize}×${gridSize} exceeds your plan maximum of ${limits.maxGridSize}×${limits.maxGridSize}.`,
    };
  }
  return { ok: true };
}

export function assertScheduleAllowed(
  scheduleType: string,
  limits: PlanLimits
): { ok: true } | { ok: false; message: string } {
  if (!limits.allowedScheduleFrequencies.includes(scheduleType as never)) {
    return {
      ok: false,
      message: `Scheduled ${scheduleType} scans are not available on your plan.`,
    };
  }
  return { ok: true };
}
