import type { ReviewAnalyticsDashboardData } from "@/components/reviews/review-analytics-dashboard";

export const REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID = "preview-review-analytics";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const start = new Date("2024-03-28T12:00:00.000Z");

const timelinePoints = Array.from({ length: 90 }, (_, index) => {
  const date = ymd(addDays(start, index));
  const wave = index % 9;
  const you = [0, 1, 0, 1, 0, 2, 1, 0, 1][wave] ?? 0;
  const top = [1, 0, 1, 1, 0, 1, 1, 2, 0][wave] ?? 0;
  const second = [0, 1, 0, 0, 1, 0, 1, 0, 1][wave] ?? 0;
  const events = [];
  if (index === 28) {
    events.push({
      id: "campaign-summer-cleanouts",
      date,
      type: "campaign_start" as const,
      label: "Summer cleanout review request",
    });
  }
  if (index === 58) {
    events.push({
      id: "maps-scan-june",
      date,
      type: "maps_scan" as const,
      label: "June Maps scan",
    });
  }
  return {
    date,
    you,
    competitorAvg: Math.round(((top + second) / 2) * 10) / 10,
    competitorSeries: {
      drainmasters: top,
      clearflow: second,
    },
    events,
  };
});

export const reviewAnalyticsPreviewData: ReviewAnalyticsDashboardData = {
  businessId: REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID,
  businessName: "A-Team Junk Removal",
  timezone: "America/New_York",
  lastSyncedAt: "2024-06-25T17:10:00.000Z",
  groupModes: ["daily", "weekly", "monthly"],
  competitors: [
    { id: "drainmasters", name: "Drain Masters" },
    { id: "clearflow", name: "ClearFlow Pros" },
  ],
  timelinePoints,
  timelineByCompetitor: {
    drainmasters: timelinePoints.map((point) => point.competitorSeries?.drainmasters ?? 0),
    clearflow: timelinePoints.map((point) => point.competitorSeries?.clearflow ?? 0),
  },
  timelineEvents: timelinePoints.flatMap((point) => point.events),
  weeklyVelocity: 9,
  monthlyVelocity: 24,
  rolling7d: 9,
  rolling30d: 24,
  rolling60d: 42,
  rolling90d: 71,
  rollingPeriods: [
    { days: 7, current: 9, previous: 7, delta: 2, deltaPct: 29 },
    { days: 30, current: 24, previous: 19, delta: 5, deltaPct: 26 },
    { days: 60, current: 42, previous: 33, delta: 9, deltaPct: 27 },
    { days: 90, current: 71, previous: 57, delta: 14, deltaPct: 25 },
  ],
  priorPeriod: {
    rolling7d: 7,
    rolling30d: 19,
    rolling60d: 33,
    rolling90d: 57,
    rolling7dDelta: 2,
    rolling30dDelta: 5,
    rolling60dDelta: 9,
    rolling90dDelta: 14,
    weeklyVelocityDelta: 2,
    monthlyVelocityDelta: 5,
  },
  responseRate: 82,
  avgResponseTimeDays: 1.8,
  avgDaysBetweenReviews: 2.8,
  medianDaysBetweenReviews: 2,
  longestDroughtDays: 6,
  activeStreakDays: 5,
  accelerationPct: 26,
  momentumStatus: "Accelerating",
  momentumLabel: "Accelerating",
  drivers: [
    "30-day reviews up 5 vs prior period",
    "7-day reviews up 2 vs prior week",
    "Review requests launched before the last velocity spike",
    "Competitors averaged 21 reviews in 30 days vs your 24",
  ],
  explanation: "Momentum is accelerating: 30-day volume is up 26% and the active streak is holding.",
  competitorRelative: "You are slightly ahead of the competitor average over the last 30 days (24 vs 21).",
  totalReviews: 327,
  dateRangeLabel: "May 27 - Jun 25, 2024",
  momentumScore: 82,
  periodRows: [
    { label: "Last 7 days", reviews: 9, previous: 7, delta: 2, deltaPct: 29 },
    { label: "Last 30 days", reviews: 24, previous: 19, delta: 5, deltaPct: 26 },
    { label: "Last 60 days", reviews: 42, previous: 33, delta: 9, deltaPct: 27 },
    { label: "Last 90 days", reviews: 71, previous: 57, delta: 14, deltaPct: 25 },
  ],
};
