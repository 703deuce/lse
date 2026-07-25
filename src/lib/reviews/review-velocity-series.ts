import type {
  ReviewAnalyticsCompetitor,
  ReviewAnalyticsTimelinePoint,
} from "@/lib/reviews/review-analytics-data";

export type VelocityRangeId = "1M" | "3M" | "6M" | "1Y" | "2Y" | "YTD" | "ALL";

export const velocityRangeOptions: Array<{ id: VelocityRangeId; label: string; days?: number }> = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "2Y", label: "2Y", days: 730 },
  { id: "YTD", label: "YTD" },
  { id: "ALL", label: "ALL" },
];

export function filterTimeline(
  points: ReviewAnalyticsTimelinePoint[],
  range: VelocityRangeId
): ReviewAnalyticsTimelinePoint[] {
  if (!points.length || range === "ALL") return points;
  const latest = new Date(`${points[points.length - 1]!.date}T12:00:00Z`);
  if (range === "YTD") {
    const start = `${latest.getUTCFullYear()}-01-01`;
    return points.filter((point) => point.date >= start);
  }
  const days = velocityRangeOptions.find((option) => option.id === range)?.days;
  if (!days) return points;
  const cutoff = new Date(latest);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoffKey);
}

/**
 * Build cumulative review counts within the selected range only.
 * Starts at 0 for the window so lifetime totals do not dominate the Y-axis.
 */
export function buildCumulativeVelocitySeries(
  points: ReviewAnalyticsTimelinePoint[],
  competitors: ReviewAnalyticsCompetitor[],
  range: VelocityRangeId
) {
  const windowPoints = filterTimeline(points, range);
  const competitorIds = competitors.map((competitor) => competitor.id);
  let you = 0;
  let competitorAvg = 0;
  const competitorTotals = Object.fromEntries(competitorIds.map((id) => [id, 0]));

  return windowPoints.map((point) => {
    you += point.you;
    competitorAvg += point.competitorAvg;
    const row: Record<string, string | number> = {
      date: point.date,
      you: Math.round(you * 10) / 10,
      competitorAvg: Math.round(competitorAvg * 10) / 10,
    };
    for (const competitorId of competitorIds) {
      competitorTotals[competitorId] =
        (competitorTotals[competitorId] ?? 0) + (point.competitorSeries?.[competitorId] ?? 0);
      row[`c_${competitorId}`] = Math.round((competitorTotals[competitorId] ?? 0) * 10) / 10;
    }
    return row;
  });
}
