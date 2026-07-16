import type { AiEngine, CompanyMentionSearchRecord } from "@/lib/ai-visibility/types";
import { ENGINE_LABELS } from "@/lib/ai-visibility/types";
import type { ExtractedBrandMention } from "@/lib/providers/deepseek/ai-visibility-mentions";
import { normalizeObservedName } from "@/lib/providers/deepseek/ai-visibility-mentions";
import { heuristicDedupeMentionClusters } from "@/lib/providers/deepseek/ai-visibility-mention-dedupe";

export type MentionLeaderboardRow = {
  normalizedName: string;
  displayName: string;
  isTargetBrand: boolean;
  engineCount: number;
  totalEngines: number;
  sharePct: number;
  engines: AiEngine[];
  avgPosition: number | null;
  contexts: string[];
};

export type HistoricalMentionRow = {
  normalizedName: string;
  displayName: string;
  isTargetBrand: boolean;
  runCount: number;
  totalRuns: number;
  sharePct: number;
  lastSeenAt: string | null;
};

export type EngineMentionView = {
  engine: AiEngine;
  engineLabel: string;
  targetMentioned: boolean;
  mentionPosition: number | null;
  mentions: ExtractedBrandMention[];
};

export type SourceRow = {
  engine: AiEngine;
  engineLabel: string;
  url?: string;
  label?: string;
  position?: number;
};

export type FanoutRow = {
  engine: AiEngine;
  engineLabel: string;
  query: string;
};

export type AggregateMetrics = {
  totalRuns: number;
  completeRuns: number;
  visibilityScore: number | null;
  mentionSharePct: number | null;
  enginesMentioningTarget: number;
  totalEngines: number;
  totalEngineChecks: number;
  totalCompaniesFound: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
};

export type VisibilityTrendPoint = {
  runId: string;
  date: string;
  visibilityScore: number | null;
  targetMentioned: boolean | null;
  companyCount: number;
  enginesChecked: number;
};

function pickDisplayName(mentions: ExtractedBrandMention[]): string {
  const withCase = mentions.find((m) => /[A-Z]/.test(m.name));
  return withCase?.name ?? mentions[0]?.name ?? "";
}

export function buildMentionLeaderboard(params: {
  engineResults: Array<{
    engine: AiEngine;
    mentions_json?: ExtractedBrandMention[] | null;
  }>;
}): MentionLeaderboardRow[] {
  const totalEngines = params.engineResults.length;
  if (!totalEngines) return [];

  const tagged = params.engineResults.flatMap((er) =>
    (er.mentions_json ?? []).map((m) => ({
      name: m.name,
      normalizedName: m.normalizedName || normalizeObservedName(m.name),
      engine: er.engine,
      mention: m,
    }))
  );

  const clusters = heuristicDedupeMentionClusters(
    tagged.map((t) => ({
      name: t.name,
      normalizedName: t.normalizedName,
      engine: t.engine,
    }))
  );

  const mentionByKey = new Map<string, ExtractedBrandMention[]>();
  for (const t of tagged) {
    const cluster = clusters.find(
      (c) =>
        c.normalizedName === t.normalizedName ||
        c.aliases.includes(t.name) ||
        c.aliases.some((a) => normalizeObservedName(a) === t.normalizedName)
    );
    const key = cluster?.normalizedName ?? t.normalizedName;
    if (!key) continue;
    const list = mentionByKey.get(key) ?? [];
    list.push(t.mention);
    mentionByKey.set(key, list);
  }

  return clusters
    .map((cluster) => {
      const mentions = mentionByKey.get(cluster.normalizedName) ?? [];
      const positions = mentions.map((m) => m.position).filter((p): p is number => p != null);
      const avgPosition = positions.length
        ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
        : null;
      return {
        normalizedName: cluster.normalizedName,
        displayName: cluster.canonicalName,
        isTargetBrand: mentions.some((m) => m.isTargetBrand),
        engineCount: cluster.engineCount,
        totalEngines,
        sharePct: Math.round((cluster.engineCount / totalEngines) * 100),
        engines: cluster.engines,
        avgPosition,
        contexts: [...new Set(mentions.map((m) => m.context).filter(Boolean) as string[])].slice(0, 3),
      };
    })
    .sort((a, b) => {
      if (a.isTargetBrand !== b.isTargetBrand) return a.isTargetBrand ? -1 : 1;
      return b.engineCount - a.engineCount || b.sharePct - a.sharePct;
    });
}

export function buildHistoricalMentions(params: {
  runs: Array<{ id: string; created_at: string }>;
  engineResults: Array<{
    run_id: string;
    mentions_json?: ExtractedBrandMention[] | null;
  }>;
}): HistoricalMentionRow[] {
  const totalRuns = params.runs.length;
  if (!totalRuns) return [];

  const runDates = new Map(params.runs.map((r) => [r.id, r.created_at]));
  const byKey = new Map<
    string,
    { mentions: ExtractedBrandMention[]; runIds: Set<string>; lastSeenAt: string | null }
  >();

  for (const er of params.engineResults) {
    const runAt = runDates.get(er.run_id) ?? null;
    for (const m of er.mentions_json ?? []) {
      const key = m.normalizedName || normalizeObservedName(m.name);
      if (!key) continue;
      const row = byKey.get(key) ?? { mentions: [], runIds: new Set(), lastSeenAt: null };
      row.mentions.push(m);
      row.runIds.add(er.run_id);
      if (runAt && (!row.lastSeenAt || runAt > row.lastSeenAt)) row.lastSeenAt = runAt;
      byKey.set(key, row);
    }
  }

  return [...byKey.entries()]
    .map(([normalizedName, { mentions, runIds, lastSeenAt }]) => ({
      normalizedName,
      displayName: pickDisplayName(mentions),
      isTargetBrand: mentions.some((m) => m.isTargetBrand),
      runCount: runIds.size,
      totalRuns,
      sharePct: Math.round((runIds.size / totalRuns) * 100),
      lastSeenAt,
    }))
    .sort((a, b) => b.runCount - a.runCount || b.sharePct - a.sharePct);
}

export function buildEngineMentionViews(
  engineResults: Array<{
    engine: AiEngine;
    target_mentioned: boolean;
    mention_position: number | null;
    mentions_json?: ExtractedBrandMention[] | null;
  }>
): EngineMentionView[] {
  return engineResults.map((er) => ({
    engine: er.engine,
    engineLabel: ENGINE_LABELS[er.engine],
    targetMentioned: er.target_mentioned,
    mentionPosition: er.mention_position,
    mentions: er.mentions_json ?? [],
  }));
}

export function collectSources(
  engineResults: Array<{
    engine: AiEngine;
    sources_json?: Array<{ url?: string; label?: string; position?: number }>;
  }>
): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const er of engineResults) {
    for (const s of er.sources_json ?? []) {
      rows.push({
        engine: er.engine,
        engineLabel: ENGINE_LABELS[er.engine],
        url: s.url,
        label: s.label,
        position: s.position,
      });
    }
  }
  return rows;
}

export function collectFanouts(
  engineResults: Array<{ engine: AiEngine; fanouts_json?: string[] }>
): FanoutRow[] {
  const rows: FanoutRow[] = [];
  for (const er of engineResults) {
    for (const q of er.fanouts_json ?? []) {
      if (!q.trim()) continue;
      rows.push({ engine: er.engine, engineLabel: ENGINE_LABELS[er.engine], query: q.trim() });
    }
  }
  return rows;
}

export function countUniqueCompanies(
  engineResults: Array<{ mentions_json?: ExtractedBrandMention[] | null }>
): number {
  const keys = new Set<string>();
  for (const er of engineResults) {
    for (const m of er.mentions_json ?? []) {
      const key = m.normalizedName || normalizeObservedName(m.name);
      if (key) keys.add(key);
    }
  }
  return keys.size;
}

export function buildAggregateMetrics(params: {
  runs: Array<{
    id: string;
    status: string;
    created_at: string;
    finished_at?: string | null;
  }>;
  engineResults: Array<{
    run_id: string;
    engine: AiEngine;
    status: string;
    target_mentioned: boolean;
    mentions_json?: ExtractedBrandMention[] | null;
  }>;
  totalEngines: number;
}): AggregateMetrics {
  const completeRunIds = new Set(
    params.runs
      .filter((r) => r.status === "complete" || r.status === "completed_with_errors")
      .map((r) => r.id)
  );
  const completeResults = params.engineResults.filter(
    (er) => completeRunIds.has(er.run_id) && er.status === "complete"
  );

  const completeRuns = completeRunIds.size;
  const totalRuns = params.runs.filter((r) => r.status !== "running").length;
  const totalEngineChecks = completeResults.length;

  const mentionedChecks = completeResults.filter((er) => er.target_mentioned).length;
  const visibilityScore = totalEngineChecks
    ? Math.round((mentionedChecks / totalEngineChecks) * 100)
    : null;

  let targetMentions = 0;
  let allMentions = 0;
  const enginesWithTarget = new Set<AiEngine>();

  for (const er of completeResults) {
    if (er.target_mentioned) enginesWithTarget.add(er.engine);
    for (const m of er.mentions_json ?? []) {
      allMentions += 1;
      if (m.isTargetBrand) targetMentions += 1;
    }
  }

  const mentionSharePct = allMentions
    ? Math.round((targetMentions / allMentions) * 100)
    : null;

  const companyKeys = new Set<string>();
  for (const er of completeResults) {
    for (const m of er.mentions_json ?? []) {
      const key = m.normalizedName || normalizeObservedName(m.name);
      if (key) companyKeys.add(key);
    }
  }

  const finishedRuns = params.runs
    .filter((r) => r.status === "complete" || r.status === "completed_with_errors")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return {
    totalRuns,
    completeRuns,
    visibilityScore,
    mentionSharePct,
    enginesMentioningTarget: enginesWithTarget.size,
    totalEngines: params.totalEngines,
    totalEngineChecks,
    totalCompaniesFound: companyKeys.size,
    firstRunAt: finishedRuns[0]?.created_at ?? null,
    lastRunAt: finishedRuns[finishedRuns.length - 1]?.created_at ?? null,
  };
}

export function buildVisibilityTrend(params: {
  runs: Array<{
    id: string;
    status: string;
    visibility_score: number | null;
    target_mentioned: boolean | null;
    engines_checked: number;
    created_at: string;
  }>;
  engineResultsByRun: Map<string, Array<{ mentions_json?: ExtractedBrandMention[] | null }>>;
}): VisibilityTrendPoint[] {
  return params.runs
    .filter((r) => r.status === "complete" || r.status === "completed_with_errors")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((run) => ({
      runId: run.id,
      date: run.created_at,
      visibilityScore: run.visibility_score,
      targetMentioned: run.target_mentioned,
      companyCount: countUniqueCompanies(params.engineResultsByRun.get(run.id) ?? []),
      enginesChecked: run.engines_checked,
    }));
}

const SOURCE_STOP_WORDS = new Set([
  "junk",
  "removal",
  "llc",
  "inc",
  "corp",
  "ltd",
  "the",
  "and",
  "va",
  "woodbridge",
  "services",
  "service",
  "company",
  "best",
  "top",
]);

function distinctiveTokens(text: string, query?: string): string[] {
  const normalized = normalizeObservedName(query?.trim() || text);
  const tokens = normalized.split(" ").filter((t) => t.length > 1 && !SOURCE_STOP_WORDS.has(t));
  if (tokens.length) return tokens;
  return normalized.split(" ").filter((t) => t.length > 2);
}

export function filterSourcesForCompany(
  sources: Array<{ url?: string; label?: string; position?: number }>,
  companyName: string,
  query?: string
): Array<{ url?: string; label?: string; position?: number }> {
  const tokens = distinctiveTokens(companyName, query);
  if (!tokens.length) return [];

  return sources.filter((s) => {
    const hay = `${s.label ?? ""} ${s.url ?? ""}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });
}

function pickBetterLabel(current: string, candidate: string): string {
  if (candidate.length > current.length) return candidate;
  const currentHasCase = /[A-Z]/.test(current);
  const candidateHasCase = /[A-Z]/.test(candidate);
  if (candidateHasCase && !currentHasCase) return candidate;
  return current;
}

export function buildMentionSearchRecords(params: {
  engineResults: Array<{
    run_id: string;
    run_at: string;
    engine: AiEngine;
    mentions_json?: ExtractedBrandMention[] | null;
    sources_json?: Array<{ url?: string; label?: string; position?: number }>;
  }>;
}): CompanyMentionSearchRecord[] {
  const records: CompanyMentionSearchRecord[] = [];

  for (const er of params.engineResults) {
    const sources = er.sources_json ?? [];
    for (const m of er.mentions_json ?? []) {
      const companyName = m.name;
      const relevantSources = filterSourcesForCompany(sources, companyName);
      records.push({
        runId: er.run_id,
        runAt: er.run_at,
        engine: er.engine,
        companyName,
        normalizedName: m.normalizedName || normalizeObservedName(m.name),
        position: m.position ?? null,
        context: m.context ?? null,
        isTargetBrand: m.isTargetBrand,
        sources,
        relevantSources,
      });
    }
  }

  return records.sort((a, b) => b.runAt.localeCompare(a.runAt));
}

export function filterMentionSearchRecords(
  records: CompanyMentionSearchRecord[],
  query: string
): CompanyMentionSearchRecord[] {
  const q = normalizeObservedName(query);
  if (!q || q.length < 2) return [];

  const matched = records.filter((r) => {
    const name = r.normalizedName || normalizeObservedName(r.companyName);
    if (name.includes(q)) return true;
    const tokens = q.split(" ").filter((t) => t.length > 1);
    return tokens.length > 0 && tokens.every((t) => name.includes(t));
  });

  const collapsed = new Map<string, CompanyMentionSearchRecord>();
  for (const row of matched) {
    const clusterKey = `${row.runId}:${row.engine}:${q}`;
    const existing = collapsed.get(clusterKey);
    const relevantSources = filterSourcesForCompany(row.sources, row.companyName, query);

    if (!existing) {
      collapsed.set(clusterKey, { ...row, relevantSources });
      continue;
    }

    collapsed.set(clusterKey, {
      ...existing,
      companyName: pickBetterLabel(existing.companyName, row.companyName),
      position: existing.position ?? row.position,
      context: existing.context || row.context,
      relevantSources: mergeUniqueSources(existing.relevantSources, relevantSources),
    });
  }

  return [...collapsed.values()].sort((a, b) => b.runAt.localeCompare(a.runAt));
}

function mergeUniqueSources(
  a: Array<{ url?: string; label?: string; position?: number }>,
  b: Array<{ url?: string; label?: string; position?: number }>
) {
  const seen = new Set<string>();
  const merged: Array<{ url?: string; label?: string; position?: number }> = [];
  for (const s of [...a, ...b]) {
    const key = (s.url ?? s.label ?? "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged;
}

export type CompanySuggestion = { key: string; label: string };

export function uniqueCompanyNames(records: CompanyMentionSearchRecord[]): CompanySuggestion[] {
  const byKey = new Map<string, string>();
  for (const r of records) {
    const key = r.normalizedName || normalizeObservedName(r.companyName);
    if (!key) continue;
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickBetterLabel(existing, r.companyName) : r.companyName);
  }
  return [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
