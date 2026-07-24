import { differenceInCalendarDays, startOfMonth, startOfWeek, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { auditOwnerResponsesFromStored } from "@/lib/reputation/response-audit";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { loadStoredReviews, type StoredReviewRow } from "@/lib/reviews/review-store";

export type GroupMode = "daily" | "weekly" | "monthly";
export type MomentumStatus = "Accelerating" | "Stable" | "Slowing" | "Stalled" | "Recovering" | "Volatile";

export type ReviewAnalyticsEvent = {
  id: string;
  date: string;
  type: "campaign_start" | "maps_scan";
  label: string;
};

export type RollingPeriodMetric = {
  days: 7 | 30 | 60 | 90;
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
};

export type ReviewAnalyticsTimelinePoint = {
  date: string;
  you: number;
  competitorAvg: number;
  competitorSeries?: Record<string, number>;
  events: ReviewAnalyticsEvent[];
};

export type ReviewAnalyticsData = {
  businessId: string;
  businessName: string;
  timezone: string;
  lastSyncedAt: string | null;
  groupModes: GroupMode[];
  competitors: Array<{ id: string; name: string }>;
  timelinePoints: ReviewAnalyticsTimelinePoint[];
  timelineByCompetitor?: Record<string, number[]>;
  timelineEvents: ReviewAnalyticsEvent[];
  weeklyVelocity: number;
  monthlyVelocity: number;
  rolling7d: number;
  rolling30d: number;
  rolling60d: number;
  rolling90d: number;
  rollingPeriods: RollingPeriodMetric[];
  priorPeriod: {
    rolling7d: number;
    rolling30d: number;
    rolling60d: number;
    rolling90d: number;
    rolling7dDelta: number;
    rolling30dDelta: number;
    rolling60dDelta: number;
    rolling90dDelta: number;
    weeklyVelocityDelta: number;
    monthlyVelocityDelta: number;
  };
  responseRate: number;
  avgResponseTimeDays: number | null;
  avgDaysBetweenReviews: number | null;
  medianDaysBetweenReviews: number | null;
  longestDroughtDays: number | null;
  activeStreakDays: number;
  accelerationPct: number | null;
  momentumStatus: MomentumStatus;
  momentumLabel: string;
  drivers: string[];
  explanation: string;
  competitorRelative: string;
};

const DEFAULT_TIMEZONE = "America/New_York";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundPct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return numerator > 0 ? 100 : null;
  return round1((numerator / denominator) * 100);
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

function parseYmdAsNoonUtc(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
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
    if (row.is_deleted) continue;
    const key = dateKeyForRow(row, timezone);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rowsInWindow(rows: StoredReviewRow[], startYmd: string, endYmd: string, timezone: string): StoredReviewRow[] {
  return rows.filter((row) => {
    if (row.is_deleted) return false;
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

function rollingPeriod(rows: StoredReviewRow[], days: 7 | 30 | 60 | 90, timezone: string): RollingPeriodMetric {
  const current = countWindow(rows, days - 1, 0, timezone);
  const previous = countWindow(rows, days * 2 - 1, days, timezone);
  return {
    days,
    current,
    previous,
    delta: current - previous,
    deltaPct: roundPct(current - previous, previous),
  };
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
    diffs.push(differenceInCalendarDays(parseYmdAsNoonUtc(uniqueDates[i]!), parseYmdAsNoonUtc(uniqueDates[i - 1]!)));
  }

  const start90 = ymdInTimeZone(subDays(new Date(), 89), timezone);
  const droughtGaps = [
    differenceInCalendarDays(parseYmdAsNoonUtc(uniqueDates[0]!), parseYmdAsNoonUtc(start90)),
    ...diffs,
    differenceInCalendarDays(parseYmdAsNoonUtc(todayKey), parseYmdAsNoonUtc(uniqueDates[uniqueDates.length - 1]!)),
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

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function bucketLabel(date: string, mode: GroupMode): string {
  const d = parseYmdAsNoonUtc(date);
  if (mode === "daily") return date;
  if (mode === "weekly") return isoWeekLabel(startOfWeek(d, { weekStartsOn: 1 }));
  const month = startOfMonth(d);
  return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function aggregateReviewAnalyticsTimeline(
  points: ReviewAnalyticsTimelinePoint[],
  mode: GroupMode
): ReviewAnalyticsTimelinePoint[] {
  if (mode === "daily") return points;
  const buckets = new Map<
    string,
    { you: number; competitorAvg: number; competitorSeries: Record<string, number>; days: number; events: ReviewAnalyticsEvent[] }
  >();
  for (const point of points) {
    const key = bucketLabel(point.date, mode);
    const bucket = buckets.get(key) ?? { you: 0, competitorAvg: 0, competitorSeries: {}, days: 0, events: [] };
    bucket.you += point.you;
    bucket.competitorAvg += point.competitorAvg;
    for (const [competitorId, count] of Object.entries(point.competitorSeries ?? {})) {
      bucket.competitorSeries[competitorId] = (bucket.competitorSeries[competitorId] ?? 0) + count;
    }
    bucket.days += 1;
    bucket.events.push(...point.events);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    you: bucket.you,
    competitorAvg: round1(bucket.competitorAvg),
    competitorSeries: bucket.competitorSeries,
    events: bucket.events,
  }));
}

async function loadTimelineEvents(businessId: string, timezone: string, lookbackDays = 180): Promise<ReviewAnalyticsEvent[]> {
  const supabase = createServiceClient();
  const since = subDays(new Date(), lookbackDays).toISOString();
  const [campaignResult, scanResult] = await Promise.all([
    supabase
      .from("review_request_campaigns")
      .select("id, name, started_at, created_at")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("scan_batches")
      .select("id, finished_at, created_at, status")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const events: ReviewAnalyticsEvent[] = [];
  if (!campaignResult.error) {
    for (const campaign of campaignResult.data ?? []) {
      const when = campaign.started_at ?? campaign.created_at;
      if (!when) continue;
      events.push({
        id: `campaign-${campaign.id}`,
        date: ymdInTimeZone(new Date(when), timezone),
        type: "campaign_start",
        label: String(campaign.name ?? "Campaign started"),
      });
    }
  }

  if (!scanResult.error) {
    for (const scan of scanResult.data ?? []) {
      const when = scan.finished_at;
      if (!when) continue;
      events.push({
        id: `scan-${scan.id}`,
        date: ymdInTimeZone(new Date(when), timezone),
        type: "maps_scan",
        label: `Maps scan ${String(scan.status ?? "finished")}`,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function classifyMomentum(params: {
  rolling7d: number;
  rolling30d: number;
  rolling60d: number;
  prior7d: number;
  prior30d: number;
  prior60d: number;
  competitor30dAvg: number;
}): { status: MomentumStatus; drivers: string[]; accelerationPct: number | null; explanation: string } {
  const accelerationPct = roundPct(params.rolling30d - params.prior30d, params.prior30d);
  const drivers: string[] = [];
  const delta7 = params.rolling7d - params.prior7d;
  const delta30 = params.rolling30d - params.prior30d;
  const delta60 = params.rolling60d - params.prior60d;

  if (delta7 > 0) drivers.push(`7-day reviews up ${delta7} vs prior week`);
  if (delta7 < 0) drivers.push(`7-day reviews down ${Math.abs(delta7)} vs prior week`);
  if (delta30 > 0) drivers.push(`30-day reviews up ${delta30} vs prior period`);
  if (delta30 < 0) drivers.push(`30-day reviews down ${Math.abs(delta30)} vs prior period`);
  if (params.competitor30dAvg > 0) {
    drivers.push(
      params.rolling30d >= params.competitor30dAvg
        ? `Ahead of competitor average (${params.rolling30d} vs ${params.competitor30dAvg})`
        : `Behind competitor average (${params.rolling30d} vs ${params.competitor30dAvg})`
    );
  }

  let status: MomentumStatus = "Stable";
  if (params.rolling30d === 0) status = "Stalled";
  else if (params.prior30d === 0 && params.rolling30d > 0) status = "Recovering";
  else if (delta7 > 0 && params.prior30d > params.rolling30d && params.rolling30d > 0) status = "Recovering";
  else if (Math.sign(delta7) !== Math.sign(delta30) && Math.abs(delta7) + Math.abs(delta30) >= 4) status = "Volatile";
  else if ((accelerationPct ?? 0) >= 25 || (delta30 > 0 && delta60 >= 0)) status = "Accelerating";
  else if ((accelerationPct ?? 0) <= -25 || (delta30 < 0 && delta60 < 0)) status = "Slowing";

  if (!drivers.length) drivers.push("Review velocity is unchanged against the prior period");
  const explanation = `Momentum is ${status.toLowerCase()}: ${drivers.slice(0, 2).join("; ")}.`;
  return { status, drivers, accelerationPct, explanation };
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
  const competitors = competitorEntities
    .map((entity) => ({
      id: entity.competitor_id ?? entity.id,
      name: String(entity.name ?? "Competitor"),
    }))
    .filter((competitor) => Boolean(competitor.id));
  const competitorIds = competitors.map((competitor) => competitor.id);

  const [targetRows, competitorRows, timelineEvents] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    competitorIds.length ? loadStoredReviews(supabase, { competitorIds, lookbackDays: 180 }) : Promise.resolve([]),
    loadTimelineEvents(businessId, timezone, 180),
  ]);

  const keys180 = dateKeys(180, timezone);
  const keys90 = keys180.slice(-90);
  const keyStart90 = keys90[0]!;
  const keyEnd90 = keys90[keys90.length - 1]!;
  const target90 = rowsInWindow(targetRows, keyStart90, keyEnd90, timezone);
  const targetCounts = countByDate(targetRows, timezone);

  const competitorCountsByDate = countByDate(competitorRows, timezone);
  const competitorCountsById = new Map<string, Map<string, number>>();
  for (const competitorId of competitorIds) {
    competitorCountsById.set(
      competitorId,
      countByDate(competitorRows.filter((row) => row.competitor_id === competitorId), timezone)
    );
  }
  const competitorDivisor = Math.max(competitorIds.length, 1);
  const eventsByDate = new Map<string, ReviewAnalyticsEvent[]>();
  for (const event of timelineEvents) {
    const bucket = eventsByDate.get(event.date) ?? [];
    bucket.push(event);
    eventsByDate.set(event.date, bucket);
  }
  const timelineByCompetitor: Record<string, number[]> = {};
  for (const competitorId of competitorIds) {
    const counts = competitorCountsById.get(competitorId);
    timelineByCompetitor[competitorId] = keys180.map((date) => counts?.get(date) ?? 0);
  }
  const timelinePoints = keys180.map((date, index) => {
    const competitorSeries = Object.fromEntries(
      competitorIds.map((competitorId) => [competitorId, timelineByCompetitor[competitorId]?.[index] ?? 0])
    );
    return {
      date,
      you: targetCounts.get(date) ?? 0,
      competitorAvg: round1((competitorCountsByDate.get(date) ?? 0) / competitorDivisor),
      competitorSeries,
      events: eventsByDate.get(date) ?? [],
    };
  });

  const rollingPeriods = ([7, 30, 60, 90] as const).map((days) => rollingPeriod(targetRows, days, timezone));
  const rolling7 = rollingPeriods.find((period) => period.days === 7)!;
  const rolling30 = rollingPeriods.find((period) => period.days === 30)!;
  const rolling60 = rollingPeriods.find((period) => period.days === 60)!;
  const rolling90 = rollingPeriods.find((period) => period.days === 90)!;

  const targetEntity = momentum?.entities.find((entity) => entity.entity_type === "target");
  const weeklyVelocity = rolling7.current;
  const monthlyVelocity = rolling30.current;
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

  const momentumStatus = classifyMomentum({
    rolling7d: rolling7.current,
    rolling30d: rolling30.current,
    rolling60d: rolling60.current,
    prior7d: rolling7.previous,
    prior30d: rolling30.previous,
    prior60d: rolling60.previous,
    competitor30dAvg,
  });
  const momentumLabel = String(targetEntity?.momentum_label ?? momentumStatus.status);

  const competitorRelative =
    competitorIds.length === 0
      ? "Run Review Momentum to add competitor benchmarks."
      : rolling30.current >= competitor30dAvg
        ? `You matched or beat the competitor average over 30 days (${rolling30.current} vs ${competitor30dAvg}).`
        : `Competitors averaged ${competitor30dAvg} reviews in 30 days vs your ${rolling30.current}.`;

  const responseAudit = auditOwnerResponsesFromStored(target90.map((row) => ({
    id: row.id,
    rating: row.rating,
    review_text: row.review_text,
    owner_response_text: row.owner_response_text,
    published_at: row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null),
    owner_responded_at: row.owner_responded_at ?? null,
    reviewer_name: row.reviewer_name,
  })));

  return {
    businessId,
    businessName,
    timezone,
    lastSyncedAt: momentum?.run.finished_at ?? momentum?.run.created_at ?? null,
    groupModes: ["daily", "weekly", "monthly"],
    competitors,
    timelinePoints,
    timelineByCompetitor,
    timelineEvents,
    weeklyVelocity,
    monthlyVelocity,
    rolling7d: rolling7.current,
    rolling30d: rolling30.current,
    rolling60d: rolling60.current,
    rolling90d: rolling90.current,
    rollingPeriods,
    priorPeriod: {
      rolling7d: rolling7.previous,
      rolling30d: rolling30.previous,
      rolling60d: rolling60.previous,
      rolling90d: rolling90.previous,
      rolling7dDelta: rolling7.delta,
      rolling30dDelta: rolling30.delta,
      rolling60dDelta: rolling60.delta,
      rolling90dDelta: rolling90.delta,
      weeklyVelocityDelta: rolling7.delta,
      monthlyVelocityDelta: rolling30.delta,
    },
    responseRate: responseAudit.responseRate,
    avgResponseTimeDays: responseAudit.avgResponseTimeDays ?? null,
    avgDaysBetweenReviews: stats.avg,
    medianDaysBetweenReviews: stats.median,
    longestDroughtDays: stats.longestDrought,
    activeStreakDays: stats.activeStreak,
    accelerationPct: momentumStatus.accelerationPct,
    momentumStatus: momentumStatus.status,
    momentumLabel,
    drivers: momentumStatus.drivers,
    explanation: momentumStatus.explanation,
    competitorRelative,
  };
}
