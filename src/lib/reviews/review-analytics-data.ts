import { differenceInCalendarDays, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { loadStoredReviews, type StoredReviewRow } from "@/lib/reviews/review-store";

type GroupMode = "daily" | "weekly" | "monthly";

export type ReviewAnalyticsTimelinePoint = {
  date: string;
  you: number;
  competitorAvg: number;
};

export type ReviewAnalyticsData = {
  businessId: string;
  businessName: string;
  timezone: string;
  lastSyncedAt: string | null;
  groupModes: GroupMode[];
  timelinePoints: ReviewAnalyticsTimelinePoint[];
  weeklyVelocity: number;
  monthlyVelocity: number;
  rolling7d: number;
  rolling30d: number;
  priorPeriod: {
    rolling7d: number;
    rolling30d: number;
    rolling90d: number;
    rolling7dDelta: number;
    rolling30dDelta: number;
    rolling90dDelta: number;
    weeklyVelocityDelta: number;
    monthlyVelocityDelta: number;
  };
  avgDaysBetweenReviews: number | null;
  medianDaysBetweenReviews: number | null;
  longestDroughtDays: number | null;
  activeStreakDays: number;
  accelerationPct: number | null;
  momentumLabel: string;
  explanation: string;
  competitorRelative: string;
};

const DEFAULT_TIMEZONE = "America/New_York";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function ymdInTimeZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyForRow(row: StoredReviewRow, timezone: string): string | null {
  if (row.published_at) return ymdInTimeZone(new Date(row.published_at), timezone);
  if (row.review_date) return row.review_date.slice(0, 10);
  return null;
}

function dateKeys(days: number, timezone: string, now = new Date()): string[] {
  return Array.from({ length: days }, (_, i) => ymdInTimeZone(subDays(now, days - 1 - i), timezone));
}

function countByDate(rows: StoredReviewRow[], timezone: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = dateKeyForRow(row, timezone);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rowsInWindow(rows: StoredReviewRow[], startYmd: string, endYmd: string, timezone: string): StoredReviewRow[] {
  return rows.filter((row) => {
    const key = dateKeyForRow(row, timezone);
    return Boolean(key && key >= startYmd && key <= endYmd);
  });
}

function countWindow(rows: StoredReviewRow[], daysAgoStart: number, daysAgoEnd: number, timezone: string): number {
  const now = new Date();
  const start = ymdInTimeZone(subDays(now, daysAgoStart), timezone);
  const end = ymdInTimeZone(subDays(now, daysAgoEnd), timezone);
  return rowsInWindow(rows, start, end, timezone).length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round1((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

function daysBetweenStats(rows90: StoredReviewRow[], timezone: string): {
  avg: number | null;
  median: number | null;
  longestDrought: number | null;
  activeStreak: number;
} {
  const todayKey = ymdInTimeZone(new Date(), timezone);
  const uniqueDates = Array.from(
    new Set(rows90.map((row) => dateKeyForRow(row, timezone)).filter((d): d is string => Boolean(d)))
  ).sort();

  if (!uniqueDates.length) {
    return { avg: null, median: null, longestDrought: null, activeStreak: 0 };
  }

  const diffs: number[] = [];
  for (let i = 1; i < uniqueDates.length; i++) {
    diffs.push(differenceInCalendarDays(new Date(`${uniqueDates[i]}T12:00:00Z`), new Date(`${uniqueDates[i - 1]}T12:00:00Z`)));
  }

  const start90 = ymdInTimeZone(subDays(new Date(), 89), timezone);
  const droughtGaps = [
    differenceInCalendarDays(new Date(`${uniqueDates[0]}T12:00:00Z`), new Date(`${start90}T12:00:00Z`)),
    ...diffs,
    differenceInCalendarDays(new Date(`${todayKey}T12:00:00Z`), new Date(`${uniqueDates[uniqueDates.length - 1]}T12:00:00Z`)),
  ].filter((gap) => gap >= 0);

  const dateSet = new Set(uniqueDates);
  let activeStreak = 0;
  for (let i = 0; i < 90; i++) {
    const key = ymdInTimeZone(subDays(new Date(), i), timezone);
    if (!dateSet.has(key)) break;
    activeStreak++;
  }

  return {
    avg: diffs.length ? round1(diffs.reduce((sum, n) => sum + n, 0) / diffs.length) : null,
    median: median(diffs),
    longestDrought: droughtGaps.length ? Math.max(...droughtGaps) : null,
    activeStreak,
  };
}

async function loadBusinessMeta(businessId: string): Promise<{ name: string; timezone: string }> {
  const supabase = createServiceClient();
  const withTimezone = await supabase
    .from("businesses")
    .select("name, timezone")
    .eq("id", businessId)
    .maybeSingle();

  if (withTimezone.data) {
    return {
      name: String(withTimezone.data.name ?? "Business"),
      timezone: String(withTimezone.data.timezone || DEFAULT_TIMEZONE),
    };
  }

  const fallback = await supabase.from("businesses").select("name").eq("id", businessId).maybeSingle();
  if (!fallback.data) throw new Error("Business not found");
  return { name: String(fallback.data.name ?? "Business"), timezone: DEFAULT_TIMEZONE };
}

export async function loadReviewAnalyticsData(businessId: string): Promise<ReviewAnalyticsData> {
  const supabase = createServiceClient();
  const [{ name: businessName, timezone }, momentum] = await Promise.all([
    loadBusinessMeta(businessId),
    loadLatestMomentumRun(businessId),
  ]);

  const competitorEntities = momentum?.entities.filter((entity) => entity.entity_type === "competitor") ?? [];
  const competitorIds = competitorEntities.map((entity) => entity.competitor_id).filter(Boolean) as string[];

  const [targetRows, competitorRows] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    competitorIds.length ? loadStoredReviews(supabase, { competitorIds, lookbackDays: 180 }) : Promise.resolve([]),
  ]);

  const keys90 = dateKeys(90, timezone);
  const keyStart90 = keys90[0]!;
  const keyEnd90 = keys90[keys90.length - 1]!;
  const target90 = rowsInWindow(targetRows, keyStart90, keyEnd90, timezone);
  const targetCounts = countByDate(target90, timezone);

  const competitorCountsByDate = countByDate(competitorRows, timezone);
  const competitorDivisor = Math.max(competitorIds.length, 1);
  const timelinePoints = keys90.map((date) => ({
    date,
    you: targetCounts.get(date) ?? 0,
    competitorAvg: round1((competitorCountsByDate.get(date) ?? 0) / competitorDivisor),
  }));

  const rolling7d = countWindow(targetRows, 6, 0, timezone);
  const rolling30d = countWindow(targetRows, 29, 0, timezone);
  const rolling90d = target90.length;
  const prior7d = countWindow(targetRows, 13, 7, timezone);
  const prior30d = countWindow(targetRows, 59, 30, timezone);
  const prior90d = countWindow(targetRows, 179, 90, timezone);

  const accelerationPct = prior30d === 0 ? (rolling30d > 0 ? 100 : 0) : round1(((rolling30d - prior30d) / prior30d) * 100);
  const targetEntity = momentum?.entities.find((entity) => entity.entity_type === "target");
  const momentumLabel = String(targetEntity?.momentum_label ?? (accelerationPct > 25 ? "Accelerating" : accelerationPct < -25 ? "Slowing" : "Stable"));
  const weeklyVelocity = rolling7d;
  const monthlyVelocity = rolling30d;
  const stats = daysBetweenStats(target90, timezone);

  const competitor30dAvg =
    competitorIds.length > 0
      ? round1(competitorRows.filter((row) => {
          const key = dateKeyForRow(row, timezone);
          const start = ymdInTimeZone(subDays(new Date(), 29), timezone);
          const end = ymdInTimeZone(new Date(), timezone);
          return Boolean(key && key >= start && key <= end);
        }).length / competitorIds.length)
      : 0;

  const competitorRelative =
    competitorIds.length === 0
      ? "Run Review Momentum to add competitor benchmarks."
      : rolling30d >= competitor30dAvg
        ? `You matched or beat the competitor average over 30 days (${rolling30d} vs ${competitor30dAvg}).`
        : `Competitors averaged ${competitor30dAvg} reviews in 30 days vs your ${rolling30d}.`;

  const explanation = `You gained ${rolling7d} reviews in the last 7 days and ${rolling30d} in the last 30 days. Momentum is ${momentumLabel.toLowerCase()} with ${accelerationPct == null ? "no" : `${accelerationPct}%`} acceleration vs the prior 30 days.`;

  return {
    businessId,
    businessName,
    timezone,
    lastSyncedAt: momentum?.run.finished_at ?? momentum?.run.created_at ?? null,
    groupModes: ["daily", "weekly", "monthly"],
    timelinePoints,
    weeklyVelocity,
    monthlyVelocity,
    rolling7d,
    rolling30d,
    priorPeriod: {
      rolling7d: prior7d,
      rolling30d: prior30d,
      rolling90d: prior90d,
      rolling7dDelta: rolling7d - prior7d,
      rolling30dDelta: rolling30d - prior30d,
      rolling90dDelta: rolling90d - prior90d,
      weeklyVelocityDelta: weeklyVelocity - prior7d,
      monthlyVelocityDelta: monthlyVelocity - prior30d,
    },
    avgDaysBetweenReviews: stats.avg,
    medianDaysBetweenReviews: stats.median,
    longestDroughtDays: stats.longestDrought,
    activeStreakDays: stats.activeStreak,
    accelerationPct,
    momentumLabel,
    explanation,
    competitorRelative,
  };
}
