import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReviewAnalyticsCompetitor, ReviewAnalyticsTimelinePoint } from "./review-analytics-data";
import { buildCumulativeVelocitySeries } from "./review-velocity-series";

describe("review velocity chart windowing", () => {
  const points: ReviewAnalyticsTimelinePoint[] = [
    { date: "2026-06-01", you: 5, competitorAvg: 2, competitorSeries: { c1: 2 }, events: [] },
    { date: "2026-06-15", you: 3, competitorAvg: 1, competitorSeries: { c1: 1 }, events: [] },
    { date: "2026-07-01", you: 4, competitorAvg: 0, competitorSeries: { c1: 0 }, events: [] },
    { date: "2026-07-20", you: 2, competitorAvg: 3, competitorSeries: { c1: 3 }, events: [] },
  ];
  const competitors: ReviewAnalyticsCompetitor[] = [
    {
      id: "c1",
      name: "Rival",
      rating: 4.2,
      totalReviews: 4000,
      rolling7d: 1,
      rolling30d: 5,
      rolling60d: 10,
      rolling90d: 20,
      prior30d: 4,
    },
  ];

  it("starts cumulative counts at zero for the selected range", () => {
    const series = buildCumulativeVelocitySeries(points, competitors, "1M");
    assert.ok(series.length > 0);
    assert.equal(series[0]!.you, points.find((p) => p.date === series[0]!.date)!.you);
    assert.ok(Number(series[series.length - 1]!.you) < 100);
    assert.ok(Number(series[series.length - 1]![`c_c1`]) < 100);
  });

  it("does not seed from lifetime totals", () => {
    const series = buildCumulativeVelocitySeries(points, competitors, "ALL");
    assert.equal(series[0]!.you, 5);
    assert.equal(series[series.length - 1]!.you, 14);
    assert.equal(series[series.length - 1]![`c_c1`], 6);
  });
});
