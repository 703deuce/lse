import type {
  AggregateMetrics,
  AiEngine,
  BrandMention,
  CompanyMentionSearchRecord,
  HistoricalMentionRow,
  MapPackEntry,
  MentionLeaderboardRow,
  OrganicSerpEntry,
  RunSummary,
  SerpMatchRow,
  VisibilityTrendPoint,
} from "@/lib/ai-visibility/types";

export type AiVisibilityTabId = "dashboard" | "mentions" | "landscape" | "evidence" | "history";

export type RunView = "combined" | string;

export type PromptRow = {
  id: string;
  prompt_text: string;
  status: string;
  is_primary: boolean;
  category: string | null;
  intent_type: string | null;
  opportunity_score: number | null;
  reason: string | null;
  last_run_at?: string | null;
  mention_count?: number | null;
};

export type EngineResultRow = {
  id: string;
  engine: string;
  prompt_text?: string | null;
  status: string;
  target_mentioned: boolean;
  mention_position: number | null;
  competitors_json: string[];
  mentions_json: BrandMention[];
  sources_json: Array<{ url?: string; label?: string; position?: number }>;
  fanouts_json: string[];
  answer_text: string | null;
  error_message: string | null;
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

export type VisibilityData = {
  business: { name: string; category: string; city: string; state: string; primaryKeyword: string };
  limits: { activePrompts: number; schedule: string };
  plan: string;
  activeCount: number;
  primaryPrompt: PromptRow | null;
  suggestedPrompts: PromptRow[];
  prompts: PromptRow[];
  latestRun: {
    id: string;
    status: string;
    visibility_score: number | null;
    target_mentioned: boolean | null;
    mention_position: number | null;
    competitor_count: number;
    sources_count: number;
    fanouts_count: number;
    ai_summary: string | null;
    progress_stage: string | null;
    created_at: string;
    finished_at: string | null;
  } | null;
  engineResults: EngineResultRow[];
  mentionLeaderboard: MentionLeaderboardRow[];
  historicalMentions: HistoricalMentionRow[];
  allSources: SourceRow[];
  allFanouts: FanoutRow[];
  recentRunCount: number;
  serpKeyword: string;
  mapPack: MapPackEntry[];
  organicSerp: OrganicSerpEntry[];
  serpMatches: SerpMatchRow[];
  runs: RunSummary[];
  aggregateMetrics: AggregateMetrics;
  visibilityTrend: VisibilityTrendPoint[];
  viewMode: "combined" | "run";
  selectedRunId: string | null;
  runningRun: VisibilityData["latestRun"];
  mentionSearchRecords: CompanyMentionSearchRecord[];
};
