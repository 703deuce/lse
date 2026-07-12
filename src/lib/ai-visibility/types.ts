export type PromptStatus = "active" | "suggested" | "archived";

export type AiEngine =
  | "chatgpt"
  | "perplexity"
  | "gemini"
  | "google_ai_overview"
  | "claude";

export const DEFAULT_ENGINES: AiEngine[] = [
  "chatgpt",
  "perplexity",
  "gemini",
  "google_ai_overview",
  "claude",
];

export const ENGINE_LABELS: Record<AiEngine, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  google_ai_overview: "Google AI Overview",
  claude: "Claude",
};

export type SuggestedPrompt = {
  prompt: string;
  reason: string;
  category: string;
  intent_type: string;
  estimated_priority: "High" | "Medium" | "Low";
  opportunity_score: number;
};

export type AiVisibilityPrompt = {
  id: string;
  prompt_text: string;
  status: PromptStatus;
  is_primary: boolean;
  category: string | null;
  intent_type: string | null;
  opportunity_score: number | null;
  reason: string | null;
  engines: AiEngine[];
  last_run_at?: string | null;
  mention_count?: number | null;
};

export type EngineResult = {
  engine: AiEngine;
  status: "complete" | "failed" | "skipped";
  targetMentioned: boolean;
  mentionPosition: number | null;
  competitors: string[];
  brandMentions: BrandMention[];
  sources: Array<{ url?: string; label?: string; position?: number }>;
  fanouts: string[];
  answerText: string | null;
  errorMessage?: string;
};

export type BrandMention = {
  name: string;
  normalizedName: string;
  domain?: string | null;
  isTargetBrand: boolean;
  position?: number | null;
  context?: string | null;
  confidence?: number | null;
};

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

export type SerpMatchRow = {
  name: string;
  normalizedName: string;
  aiEngineCount: number;
  inMapPack: boolean;
  mapPackPosition: number | null;
  inOrganic: boolean;
  organicPosition: number | null;
  placement: "both" | "map_pack_only" | "organic_only" | "ai_only";
  matchNote?: string | null;
  isTargetBrand?: boolean;
};

export type MapPackEntry = {
  position: number;
  title: string;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
};

export type OrganicSerpEntry = {
  position: number;
  title: string;
  url?: string | null;
  snippet?: string | null;
  domain?: string | null;
};

export type AiVisibilityRunResult = {
  runId: string;
  status: string;
  visibilityScore: number;
  targetMentioned: boolean;
  mentionPosition: number | null;
  competitorCount: number;
  sourcesCount: number;
  fanoutsCount: number;
  promptsChecked: number;
  enginesChecked: number;
  aiSummary: string | null;
  engineResults: EngineResult[];
};

export type RunSummary = {
  id: string;
  status: string;
  visibility_score: number | null;
  target_mentioned: boolean | null;
  mention_position: number | null;
  competitor_count: number;
  sources_count: number;
  fanouts_count: number;
  prompts_checked: number;
  engines_checked: number;
  ai_summary: string | null;
  created_at: string;
  finished_at: string | null;
  companyCount: number;
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

export type CompanyMentionSearchRecord = {
  runId: string;
  runAt: string;
  engine: AiEngine;
  companyName: string;
  normalizedName: string;
  position: number | null;
  context: string | null;
  isTargetBrand: boolean;
  sources: Array<{ url?: string; label?: string; position?: number }>;
  relevantSources: Array<{ url?: string; label?: string; position?: number }>;
};

export const INTENT_TYPE_LABELS: Record<string, string> = {
  primary: "Primary buyer",
  same_day: "Same-day / emergency",
  affordable: "Affordable",
  top_rated: "Top-rated",
  service_specific: "Service-specific",
  neighborhood: "Neighborhood",
  comparison: "Comparison",
  near_me: "Near me",
  problem: "Problem-based",
  category: "GBP category",
};
