/** Universal 0–100 score color scale — use everywhere scores are shown. */

export type ScoreBand = "low" | "mid" | "high";

export function getScoreBand(score: number | null | undefined): ScoreBand | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score < 40) return "low";
  if (score < 70) return "mid";
  return "high";
}

export const scoreBandClasses = {
  low: {
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    stroke: "#dc2626",
  },
  mid: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    bar: "bg-amber-500",
    stroke: "#d97706",
  },
  high: {
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    bar: "bg-emerald-500",
    stroke: "#059669",
  },
} as const;

export function scoreTextClass(score: number | null | undefined): string {
  const band = getScoreBand(score);
  return band ? scoreBandClasses[band].text : "text-zinc-900";
}

export function scoreBarColor(score: number): string {
  const band = getScoreBand(score);
  return band ? scoreBandClasses[band].bar : "bg-zinc-300";
}

export function scoreStrokeColor(score: number): string {
  const band = getScoreBand(score);
  return band ? scoreBandClasses[band].stroke : "#a1a1aa";
}

/** Delta/trend: positive = green, negative = red, flat = gray. */
export function trendTextClass(delta: number | null | undefined): string {
  if (delta == null || delta === 0) return "text-zinc-500";
  return delta > 0 ? "text-emerald-600" : "text-red-600";
}
