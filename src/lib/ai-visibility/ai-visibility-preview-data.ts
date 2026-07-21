import type { VisibilityData } from "@/components/ai-visibility/ai-visibility-types";
import type {
  AiEngine,
  BrandMention,
  HistoricalMentionRow,
  MentionLeaderboardRow,
  SerpMatchRow,
} from "@/lib/ai-visibility/types";
import { ENGINE_LABELS } from "@/lib/ai-visibility/types";

export const AI_VISIBILITY_PREVIEW_BUSINESS_ID = "preview-ai-visibility";

const RUN_JUL_21 = "run-preview-ai-vis-2026-07-21";
const RUN_JUL_16 = "run-preview-ai-vis-2026-07-16";
const RUN_JUL_13 = "run-preview-ai-vis-2026-07-13";

const PROMPT_ID = "prompt-preview-primary";

const AT_JUL_21 = "2026-07-21T14:22:00.000Z";
const AT_JUL_16 = "2026-07-16T15:10:00.000Z";
const AT_JUL_13 = "2026-07-13T13:45:00.000Z";

function mention(
  name: string,
  opts: {
    isTargetBrand?: boolean;
    position?: number | null;
    context?: string;
    domain?: string | null;
  } = {}
): BrandMention {
  const normalizedName = name
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd)\b\.?/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    name,
    normalizedName,
    domain: opts.domain ?? null,
    isTargetBrand: opts.isTargetBrand ?? false,
    position: opts.position ?? null,
    context: opts.context ?? null,
    confidence: 0.92,
  };
}

const TARGET = "Junk Removal Woodbridge";
const COMPANIES = {
  kBrooks: "K. Brooks Junk Removal LLC",
  junkluggers: "The Junkluggers of Woodbridge VA",
  nova: "Nova Junk",
  express: "Express Moving and Junk Removal",
  best: "Best Junk Removal LLC",
  vets: "Vets Haul Junk Removal",
  collegeHunks: "College Hunks Hauling Junk",
  gotJunk: "1-800-GOT-JUNK?",
  loadUp: "LoadUp",
  junkKing: "Junk King",
  diligent: "Diligent Junk Removal Woodbridge",
  sameDay: "Same Day Junk Removal VA",
  potomac: "Potomac Junk Removal",
  daleCity: "Dale City Junk Haulers",
  manassas: "Manassas Junk Pros",
  fairfax: "Fairfax Junk Away",
  springfield: "Springfield Haul Away",
  occoquan: "Occoquan Junk Removal",
} as const;

const chatgptAnswer = `Here are some of the most frequently recommended junk removal companies serving Woodbridge, VA and the surrounding Prince William County area:

1. **K. Brooks Junk Removal LLC** — Locally owned with strong reviews for furniture, appliance, and estate cleanouts. Same-day slots are often available.
2. **The Junkluggers of Woodbridge VA** — Franchise crew known for eco-friendly disposal and transparent pricing for garage, basement, and construction debris.
3. **Nova Junk** — Northern Virginia operator covering Woodbridge, Dale City, and Lake Ridge for household junk and light demolition debris.
4. **Express Moving and Junk Removal** — Combines moving help with junk hauling; useful when you're clearing a home before a move.
5. **Best Junk Removal LLC** — 24/7 local option often showing up in map results for Woodbridge junk removal.
6. **Vets Haul Junk Removal** — Veteran-owned hauling with competitive rates for mattresses, appliances, and yard waste.

When comparing providers, ask about dump fees, recycling practices, and whether the quote is all-in versus by-volume. Check recent Google reviews and confirm they serve your specific Woodbridge neighborhood (Occoquan, Lake Ridge, Potomac Mills, etc.).`;

const perplexityAnswer = `Based on recent local search results and reviews, several junk removal companies serve Woodbridge, VA:

**Junk Removal Woodbridge** is a local option that appears in area recommendations for residential cleanouts and same-day hauling in the Woodbridge / Dale City corridor.

Other frequently mentioned providers include **K. Brooks Junk Removal LLC**, **The Junkluggers of Woodbridge VA**, **Nova Junk**, and **Best Junk Removal LLC**. Franchise and regional brands such as College Hunks and 1-800-GOT-JUNK? also cover Northern Virginia.

For the best fit, compare insurance, recycling practices, and whether the crew can handle stairs or HOA access at your property.`;

const geminiAnswer = `Popular junk removal picks near Woodbridge, VA include K. Brooks Junk Removal LLC, The Junkluggers of Woodbridge VA, Nova Junk, Express Moving and Junk Removal, and Vets Haul Junk Removal. Check Google ratings, response times, and dump fees before booking.`;

const aioAnswer = `Top junk removal services in Woodbridge, VA often include K. Brooks Junk Removal LLC, Best Junk Removal LLC, The Junkluggers of Woodbridge VA, and Nova Junk. Many offer same-day pickup for furniture, appliances, and garage cleanouts.`;

const chatgptSources = [
  {
    url: "https://www.kbrooksjunkremoval.com/",
    label: "K. Brooks Junk Removal — Northern VA junk hauling",
    position: 1,
  },
  {
    url: "https://www.junkluggers.com/woodbridge-va/",
    label: "The Junkluggers of Woodbridge VA — eco-friendly junk removal",
    position: 2,
  },
  {
    url: "https://novajunk.com/",
    label: "Nova Junk — Woodbridge & Northern Virginia",
    position: 3,
  },
  {
    url: "https://www.bestjunkremovalllc.com/",
    label: "Best Junk Removal LLC — Woodbridge VA",
    position: 4,
  },
];

const perplexitySources = [
  {
    url: "https://junkremovalwoodbridge.com/",
    label: "Junk Removal Woodbridge — local junk hauling",
    position: 1,
  },
  {
    url: "https://www.angi.com/companylist/us/va/woodbridge/junk-removal.htm",
    label: "Angi — Junk Removal near Woodbridge, VA",
    position: 2,
  },
  {
    url: "https://www.yelp.com/search?cflt=junkremoval&find_loc=Woodbridge%2C+VA",
    label: "Yelp — Junk Removal in Woodbridge, VA",
    position: 3,
  },
  {
    url: "https://www.kbrooksjunkremoval.com/services/",
    label: "K. Brooks Junk Removal services page",
    position: 4,
  },
];

const geminiSources = [
  {
    url: "https://www.google.com/maps/search/junk+removal+woodbridge+va",
    label: "Google Maps — junk removal Woodbridge VA",
    position: 1,
  },
  {
    url: "https://www.junkluggers.com/woodbridge-va/pricing/",
    label: "Junkluggers Woodbridge pricing",
    position: 2,
  },
];

const aioSources = [
  {
    url: "https://www.bestjunkremovalllc.com/",
    label: "Best Junk Removal LLC homepage",
    position: 1,
  },
  {
    url: "https://www.kbrooksjunkremoval.com/",
    label: "K. Brooks Junk Removal LLC",
    position: 2,
  },
  {
    url: "https://novajunk.com/woodbridge/",
    label: "Nova Junk — Woodbridge service area",
    position: 3,
  },
];

const perplexityFanouts = [
  "best junk removal Woodbridge VA",
  "K. Brooks Junk Removal reviews",
  "Junkluggers Woodbridge VA pricing",
  "same day junk haul Lake Ridge VA",
  "junk removal Dale City near me",
  "eco friendly junk removal Prince William County",
  "Junk Removal Woodbridge company reviews",
];

const geminiFanouts = ["top rated junk removal companies Woodbridge Virginia"];

const chatgptMentions: BrandMention[] = [
  mention(COMPANIES.kBrooks, {
    position: 1,
    context: "Locally owned with strong reviews for furniture and estate cleanouts.",
    domain: "kbrooksjunkremoval.com",
  }),
  mention(COMPANIES.junkluggers, {
    position: 2,
    context: "Eco-friendly franchise serving Woodbridge VA.",
    domain: "junkluggers.com",
  }),
  mention(COMPANIES.nova, {
    position: 3,
    context: "Covers Woodbridge, Dale City, and Lake Ridge.",
    domain: "novajunk.com",
  }),
  mention(COMPANIES.express, {
    position: 4,
    context: "Combines moving help with junk hauling.",
  }),
  mention(COMPANIES.best, {
    position: 5,
    context: "Often appears in Woodbridge map results.",
    domain: "bestjunkremovalllc.com",
  }),
  mention(COMPANIES.vets, {
    position: 6,
    context: "Veteran-owned hauling with competitive rates.",
  }),
];

const perplexityMentions: BrandMention[] = [
  mention(TARGET, {
    isTargetBrand: true,
    position: 2,
    context: "Local option for residential cleanouts in the Woodbridge / Dale City corridor.",
    domain: "junkremovalwoodbridge.com",
  }),
  mention(COMPANIES.kBrooks, {
    position: 1,
    context: "Frequently mentioned local provider.",
    domain: "kbrooksjunkremoval.com",
  }),
  mention(COMPANIES.junkluggers, {
    position: 3,
    context: "Franchise coverage in Woodbridge VA.",
    domain: "junkluggers.com",
  }),
  mention(COMPANIES.nova, {
    position: 4,
    context: "Regional Northern Virginia operator.",
    domain: "novajunk.com",
  }),
  mention(COMPANIES.best, {
    position: 5,
    context: "Local Woodbridge junk removal company.",
    domain: "bestjunkremovalllc.com",
  }),
];

const geminiMentions: BrandMention[] = [
  mention(COMPANIES.kBrooks, { position: 1, domain: "kbrooksjunkremoval.com" }),
  mention(COMPANIES.junkluggers, { position: 2, domain: "junkluggers.com" }),
  mention(COMPANIES.nova, { position: 3, domain: "novajunk.com" }),
  mention(COMPANIES.express, { position: 4 }),
  mention(COMPANIES.vets, { position: 5 }),
];

const aioMentions: BrandMention[] = [
  mention(COMPANIES.kBrooks, { position: 1, domain: "kbrooksjunkremoval.com" }),
  mention(COMPANIES.best, { position: 2, domain: "bestjunkremovalllc.com" }),
  mention(COMPANIES.junkluggers, { position: 3, domain: "junkluggers.com" }),
  mention(COMPANIES.nova, { position: 4, domain: "novajunk.com" }),
];

const mentionLeaderboard: MentionLeaderboardRow[] = [
  {
    normalizedName: "k brooks junk removal",
    displayName: COMPANIES.kBrooks,
    isTargetBrand: false,
    engineCount: 4,
    totalEngines: 5,
    sharePct: 80,
    engines: ["chatgpt", "perplexity", "gemini", "google_ai_overview"],
    avgPosition: 1.0,
    contexts: ["Locally owned with strong reviews for furniture and estate cleanouts."],
  },
  {
    normalizedName: "the junkluggers of woodbridge va",
    displayName: COMPANIES.junkluggers,
    isTargetBrand: false,
    engineCount: 4,
    totalEngines: 5,
    sharePct: 80,
    engines: ["chatgpt", "perplexity", "gemini", "google_ai_overview"],
    avgPosition: 2.5,
    contexts: ["Eco-friendly franchise serving Woodbridge VA."],
  },
  {
    normalizedName: "nova junk",
    displayName: COMPANIES.nova,
    isTargetBrand: false,
    engineCount: 4,
    totalEngines: 5,
    sharePct: 80,
    engines: ["chatgpt", "perplexity", "gemini", "google_ai_overview"],
    avgPosition: 3.5,
    contexts: ["Covers Woodbridge, Dale City, and Lake Ridge."],
  },
  {
    normalizedName: "best junk removal",
    displayName: COMPANIES.best,
    isTargetBrand: false,
    engineCount: 3,
    totalEngines: 5,
    sharePct: 60,
    engines: ["chatgpt", "perplexity", "google_ai_overview"],
    avgPosition: 4.0,
    contexts: ["Often appears in Woodbridge map results."],
  },
  {
    normalizedName: "express moving and junk removal",
    displayName: COMPANIES.express,
    isTargetBrand: false,
    engineCount: 2,
    totalEngines: 5,
    sharePct: 40,
    engines: ["chatgpt", "gemini"],
    avgPosition: 4.0,
    contexts: ["Combines moving help with junk hauling."],
  },
  {
    normalizedName: "vets haul junk removal",
    displayName: COMPANIES.vets,
    isTargetBrand: false,
    engineCount: 2,
    totalEngines: 5,
    sharePct: 40,
    engines: ["chatgpt", "gemini"],
    avgPosition: 5.5,
    contexts: ["Veteran-owned hauling with competitive rates."],
  },
  {
    normalizedName: "junk removal woodbridge",
    displayName: TARGET,
    isTargetBrand: true,
    engineCount: 1,
    totalEngines: 5,
    sharePct: 20,
    engines: ["perplexity"],
    avgPosition: 2.0,
    contexts: ["Local option for residential cleanouts in the Woodbridge / Dale City corridor."],
  },
];

const historicalMentions: HistoricalMentionRow[] = [
  {
    normalizedName: "k brooks junk removal",
    displayName: COMPANIES.kBrooks,
    isTargetBrand: false,
    runCount: 3,
    totalRuns: 3,
    sharePct: 100,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "the junkluggers of woodbridge va",
    displayName: COMPANIES.junkluggers,
    isTargetBrand: false,
    runCount: 3,
    totalRuns: 3,
    sharePct: 100,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "nova junk",
    displayName: COMPANIES.nova,
    isTargetBrand: false,
    runCount: 3,
    totalRuns: 3,
    sharePct: 100,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "best junk removal",
    displayName: COMPANIES.best,
    isTargetBrand: false,
    runCount: 3,
    totalRuns: 3,
    sharePct: 100,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "junk removal woodbridge",
    displayName: TARGET,
    isTargetBrand: true,
    runCount: 3,
    totalRuns: 3,
    sharePct: 100,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "express moving and junk removal",
    displayName: COMPANIES.express,
    isTargetBrand: false,
    runCount: 2,
    totalRuns: 3,
    sharePct: 67,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "vets haul junk removal",
    displayName: COMPANIES.vets,
    isTargetBrand: false,
    runCount: 2,
    totalRuns: 3,
    sharePct: 67,
    lastSeenAt: AT_JUL_21,
  },
  {
    normalizedName: "college hunks hauling junk",
    displayName: COMPANIES.collegeHunks,
    isTargetBrand: false,
    runCount: 2,
    totalRuns: 3,
    sharePct: 67,
    lastSeenAt: AT_JUL_16,
  },
  {
    normalizedName: "1 800 got junk",
    displayName: COMPANIES.gotJunk,
    isTargetBrand: false,
    runCount: 2,
    totalRuns: 3,
    sharePct: 67,
    lastSeenAt: AT_JUL_16,
  },
  {
    normalizedName: "junk king",
    displayName: COMPANIES.junkKing,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "loadup",
    displayName: COMPANIES.loadUp,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "diligent junk removal woodbridge",
    displayName: COMPANIES.diligent,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_16,
  },
  {
    normalizedName: "same day junk removal va",
    displayName: COMPANIES.sameDay,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "potomac junk removal",
    displayName: COMPANIES.potomac,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "dale city junk haulers",
    displayName: COMPANIES.daleCity,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_16,
  },
  {
    normalizedName: "manassas junk pros",
    displayName: COMPANIES.manassas,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "fairfax junk away",
    displayName: COMPANIES.fairfax,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "springfield haul away",
    displayName: COMPANIES.springfield,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_13,
  },
  {
    normalizedName: "occoquan junk removal",
    displayName: COMPANIES.occoquan,
    isTargetBrand: false,
    runCount: 1,
    totalRuns: 3,
    sharePct: 33,
    lastSeenAt: AT_JUL_16,
  },
];

const serpMatches: SerpMatchRow[] = [
  {
    name: COMPANIES.kBrooks,
    normalizedName: "k brooks junk removal",
    aiEngineCount: 4,
    inMapPack: true,
    mapPackPosition: 1,
    inOrganic: true,
    organicPosition: 1,
    placement: "both",
    matchNote: "Matches map pack #1 and organic #1",
    isTargetBrand: false,
  },
  {
    name: COMPANIES.best,
    normalizedName: "best junk removal",
    aiEngineCount: 3,
    inMapPack: true,
    mapPackPosition: 2,
    inOrganic: true,
    organicPosition: 2,
    placement: "both",
    matchNote: "Strong Google + AI overlap",
    isTargetBrand: false,
  },
  {
    name: COMPANIES.junkluggers,
    normalizedName: "the junkluggers of woodbridge va",
    aiEngineCount: 4,
    inMapPack: true,
    mapPackPosition: 3,
    inOrganic: true,
    organicPosition: 3,
    placement: "both",
    isTargetBrand: false,
  },
  {
    name: TARGET,
    normalizedName: "junk removal woodbridge",
    aiEngineCount: 1,
    inMapPack: false,
    mapPackPosition: null,
    inOrganic: true,
    organicPosition: 6,
    placement: "organic_only",
    matchNote: "Appears in organic SERP but not map pack",
    isTargetBrand: true,
  },
  {
    name: COMPANIES.nova,
    normalizedName: "nova junk",
    aiEngineCount: 4,
    inMapPack: false,
    mapPackPosition: null,
    inOrganic: true,
    organicPosition: 5,
    placement: "organic_only",
    isTargetBrand: false,
  },
  {
    name: COMPANIES.express,
    normalizedName: "express moving and junk removal",
    aiEngineCount: 2,
    inMapPack: false,
    mapPackPosition: null,
    inOrganic: false,
    organicPosition: null,
    placement: "ai_only",
    isTargetBrand: false,
  },
  {
    name: COMPANIES.vets,
    normalizedName: "vets haul junk removal",
    aiEngineCount: 2,
    inMapPack: false,
    mapPackPosition: null,
    inOrganic: false,
    organicPosition: null,
    placement: "ai_only",
    isTargetBrand: false,
  },
  {
    name: COMPANIES.diligent,
    normalizedName: "diligent junk removal woodbridge",
    aiEngineCount: 0,
    inMapPack: true,
    mapPackPosition: 4,
    inOrganic: false,
    organicPosition: null,
    placement: "map_pack_only",
    isTargetBrand: false,
  },
];

function sourceRows(
  engine: AiEngine,
  sources: Array<{ url?: string; label?: string; position?: number }>
) {
  return sources.map((s) => ({
    engine,
    engineLabel: ENGINE_LABELS[engine],
    url: s.url,
    label: s.label,
    position: s.position,
  }));
}

const primaryPrompt = {
  id: PROMPT_ID,
  prompt_text: "Who is the best junk removal company in Woodbridge, VA?",
  status: "active",
  is_primary: true,
  category: "Core service",
  intent_type: "primary",
  opportunity_score: 5,
  reason: "Highest-intent local discovery prompt for junk removal in Woodbridge.",
  last_run_at: AT_JUL_21,
  mention_count: 3,
};

const engineResults: VisibilityData["engineResults"] = [
  {
    id: "er-chatgpt-jul21",
    engine: "chatgpt",
    prompt_text: primaryPrompt.prompt_text,
    status: "complete",
    target_mentioned: false,
    mention_position: null,
    competitors_json: [
      COMPANIES.kBrooks,
      COMPANIES.junkluggers,
      COMPANIES.nova,
      COMPANIES.express,
      COMPANIES.best,
      COMPANIES.vets,
    ],
    mentions_json: chatgptMentions,
    sources_json: chatgptSources,
    fanouts_json: [],
    answer_text: chatgptAnswer,
    error_message: null,
  },
  {
    id: "er-perplexity-jul21",
    engine: "perplexity",
    prompt_text: primaryPrompt.prompt_text,
    status: "complete",
    target_mentioned: true,
    mention_position: 2,
    competitors_json: [COMPANIES.kBrooks, COMPANIES.junkluggers, COMPANIES.nova, COMPANIES.best],
    mentions_json: perplexityMentions,
    sources_json: perplexitySources,
    fanouts_json: perplexityFanouts,
    answer_text: perplexityAnswer,
    error_message: null,
  },
  {
    id: "er-gemini-jul21",
    engine: "gemini",
    prompt_text: primaryPrompt.prompt_text,
    status: "complete",
    target_mentioned: false,
    mention_position: null,
    competitors_json: [
      COMPANIES.kBrooks,
      COMPANIES.junkluggers,
      COMPANIES.nova,
      COMPANIES.express,
      COMPANIES.vets,
    ],
    mentions_json: geminiMentions,
    sources_json: geminiSources,
    fanouts_json: geminiFanouts,
    answer_text: geminiAnswer,
    error_message: null,
  },
  {
    id: "er-aio-jul21",
    engine: "google_ai_overview",
    prompt_text: primaryPrompt.prompt_text,
    status: "complete",
    target_mentioned: false,
    mention_position: null,
    competitors_json: [COMPANIES.kBrooks, COMPANIES.best, COMPANIES.junkluggers, COMPANIES.nova],
    mentions_json: aioMentions,
    sources_json: aioSources,
    fanouts_json: [],
    answer_text: aioAnswer,
    error_message: null,
  },
  {
    id: "er-claude-jul21",
    engine: "claude",
    prompt_text: primaryPrompt.prompt_text,
    status: "provider_failed",
    target_mentioned: false,
    mention_position: null,
    competitors_json: [],
    mentions_json: [],
    sources_json: [],
    fanouts_json: [],
    answer_text: null,
    error_message: "Anthropic 401 (authentication_error): invalid x-api-key",
  },
];

const allSources = [
  ...sourceRows("chatgpt", chatgptSources),
  ...sourceRows("perplexity", perplexitySources),
  ...sourceRows("gemini", geminiSources),
  ...sourceRows("google_ai_overview", aioSources),
];

const allFanouts = [
  ...perplexityFanouts.map((query) => ({
    engine: "perplexity" as const,
    engineLabel: ENGINE_LABELS.perplexity,
    query,
  })),
  ...geminiFanouts.map((query) => ({
    engine: "gemini" as const,
    engineLabel: ENGINE_LABELS.gemini,
    query,
  })),
];

const latestRun = {
  id: RUN_JUL_21,
  status: "completed_with_errors",
  visibility_score: 20,
  target_mentioned: true,
  mention_position: 2,
  competitor_count: 6,
  sources_count: allSources.length,
  fanouts_count: allFanouts.length,
  ai_summary:
    "You appeared in Perplexity (position 2) but were absent from ChatGPT, Gemini, and Google AI Overview. K. Brooks, Junkluggers, and Nova Junk dominate multi-engine mentions. Claude failed with an Anthropic 401. Prioritize citations and local landing pages that those models already trust.",
  progress_stage: null,
  created_at: AT_JUL_21,
  finished_at: "2026-07-21T14:24:18.000Z",
};

export const aiVisibilityPreviewPayload: VisibilityData = {
  business: {
    name: TARGET,
    category: "Junk removal service",
    city: "Woodbridge",
    state: "VA",
    primaryKeyword: "junk removal woodbridge",
  },
  limits: { activePrompts: 5, schedule: "daily" },
  plan: "pro",
  activeCount: 1,
  primaryPrompt,
  suggestedPrompts: [
    {
      id: "prompt-preview-suggested-1",
      prompt_text: "Who does same-day junk removal in Dale City near Woodbridge?",
      status: "suggested",
      is_primary: false,
      category: "Neighborhood",
      intent_type: "same_day",
      opportunity_score: 4,
      reason: "Captures emergency / same-day intent in an adjacent neighborhood.",
      last_run_at: null,
      mention_count: 0,
    },
    {
      id: "prompt-preview-suggested-2",
      prompt_text: "Affordable garage cleanout companies in Woodbridge VA",
      status: "suggested",
      is_primary: false,
      category: "Affordable",
      intent_type: "affordable",
      opportunity_score: 3,
      reason: "Price-sensitive garage cleanout queries are common locally.",
      last_run_at: null,
      mention_count: 0,
    },
  ],
  prompts: [
    primaryPrompt,
    {
      id: "prompt-preview-suggested-1",
      prompt_text: "Who does same-day junk removal in Dale City near Woodbridge?",
      status: "suggested",
      is_primary: false,
      category: "Neighborhood",
      intent_type: "same_day",
      opportunity_score: 4,
      reason: "Captures emergency / same-day intent in an adjacent neighborhood.",
      last_run_at: null,
      mention_count: 0,
    },
    {
      id: "prompt-preview-suggested-2",
      prompt_text: "Affordable garage cleanout companies in Woodbridge VA",
      status: "suggested",
      is_primary: false,
      category: "Affordable",
      intent_type: "affordable",
      opportunity_score: 3,
      reason: "Price-sensitive garage cleanout queries are common locally.",
      last_run_at: null,
      mention_count: 0,
    },
  ],
  latestRun,
  engineResults,
  mentionLeaderboard,
  historicalMentions,
  allSources,
  allFanouts,
  recentRunCount: 3,
  serpKeyword: "junk removal woodbridge",
  mapPack: [
    {
      position: 1,
      title: COMPANIES.kBrooks,
      rating: 4.9,
      reviewCount: 186,
      address: "Woodbridge, VA",
    },
    {
      position: 2,
      title: COMPANIES.best,
      rating: 5.0,
      reviewCount: 41,
      address: "1100 Rockledge Vw Wy, Woodbridge, VA 22191",
    },
    {
      position: 3,
      title: COMPANIES.junkluggers,
      rating: 4.8,
      reviewCount: 112,
      address: "Woodbridge, VA",
    },
    {
      position: 4,
      title: COMPANIES.diligent,
      rating: 4.7,
      reviewCount: 28,
      address: "Woodbridge, VA",
    },
  ],
  organicSerp: [
    {
      position: 1,
      title: "Top-Rated Junk Removal Services in Northern VA | K. Brooks Junk Removal",
      url: "https://www.kbrooksjunkremoval.com/",
      snippet: "Need reliable junk removal in Woodbridge, VA? K. Brooks Junk Removal offers fast, efficient service.",
      domain: "kbrooksjunkremoval.com",
    },
    {
      position: 2,
      title: "Best Junk Removal LLC — Woodbridge VA",
      url: "https://www.bestjunkremovalllc.com/",
      snippet: "Open 24 hours for junk removal, demolition, and dumpster rental in Woodbridge.",
      domain: "bestjunkremovalllc.com",
    },
    {
      position: 3,
      title: "Junk Removal & Hauling in Woodbridge | The Junkluggers",
      url: "https://www.junkluggers.com/woodbridge-va/",
      snippet: "Eco-friendly junk removal serving Woodbridge and Prince William County.",
      domain: "junkluggers.com",
    },
    {
      position: 4,
      title: "Junk removal near Woodbridge, VA — Angi",
      url: "https://www.angi.com/companylist/us/va/woodbridge/junk-removal.htm",
      snippet: "Compare top-rated junk removal pros near you.",
      domain: "angi.com",
    },
    {
      position: 5,
      title: "Nova Junk — Northern Virginia Junk Removal",
      url: "https://novajunk.com/",
      snippet: "Residential and commercial junk hauling across NOVA including Woodbridge.",
      domain: "novajunk.com",
    },
    {
      position: 6,
      title: "Junk Removal Woodbridge — Local Junk Hauling",
      url: "https://junkremovalwoodbridge.com/",
      snippet: "Local junk removal for homes and businesses in Woodbridge, VA.",
      domain: "junkremovalwoodbridge.com",
    },
  ],
  serpMatches,
  runs: [
    {
      id: RUN_JUL_21,
      status: "completed_with_errors",
      visibility_score: 20,
      target_mentioned: true,
      mention_position: 2,
      competitor_count: 6,
      sources_count: allSources.length,
      fanouts_count: allFanouts.length,
      prompts_checked: 1,
      engines_checked: 5,
      ai_summary: latestRun.ai_summary,
      created_at: AT_JUL_21,
      finished_at: latestRun.finished_at,
      companyCount: 7,
      enginesMentioningYou: ["perplexity"],
    },
    {
      id: RUN_JUL_16,
      status: "completed_with_errors",
      visibility_score: 21,
      target_mentioned: true,
      mention_position: 3,
      competitor_count: 8,
      sources_count: 11,
      fanouts_count: 6,
      prompts_checked: 1,
      engines_checked: 5,
      ai_summary:
        "Mentioned once on Perplexity. Competitors still own ChatGPT and Gemini lists. Claude failed again on provider auth.",
      created_at: AT_JUL_16,
      finished_at: "2026-07-16T15:12:40.000Z",
      companyCount: 11,
      enginesMentioningYou: ["perplexity"],
    },
    {
      id: RUN_JUL_13,
      status: "complete",
      visibility_score: 27,
      target_mentioned: true,
      mention_position: 2,
      competitor_count: 9,
      sources_count: 10,
      fanouts_count: 5,
      prompts_checked: 1,
      engines_checked: 5,
      ai_summary:
        "Stronger early run: Perplexity mentioned you near the top. Multi-engine coverage still thin versus K. Brooks and Junkluggers.",
      created_at: AT_JUL_13,
      finished_at: "2026-07-13T13:47:22.000Z",
      companyCount: 12,
      enginesMentioningYou: ["perplexity"],
    },
  ],
  aggregateMetrics: {
    totalRuns: 3,
    completeRuns: 3,
    visibilityScore: 20,
    mentionSharePct: 8,
    enginesMentioningTarget: 1,
    totalEngines: 5,
    totalEngineChecks: 12,
    totalCompaniesFound: 19,
    firstRunAt: AT_JUL_13,
    lastRunAt: AT_JUL_21,
  },
  visibilityTrend: [
    {
      runId: RUN_JUL_13,
      date: AT_JUL_13,
      visibilityScore: 27,
      targetMentioned: true,
      companyCount: 12,
      enginesChecked: 5,
    },
    {
      runId: RUN_JUL_16,
      date: AT_JUL_16,
      visibilityScore: 21,
      targetMentioned: true,
      companyCount: 11,
      enginesChecked: 5,
    },
    {
      runId: RUN_JUL_21,
      date: AT_JUL_21,
      visibilityScore: 20,
      targetMentioned: true,
      companyCount: 7,
      enginesChecked: 5,
    },
  ],
  viewMode: "run",
  selectedRunId: RUN_JUL_21,
  runningRun: null,
  mentionSearchRecords: [
    {
      runId: RUN_JUL_21,
      runAt: AT_JUL_21,
      engine: "perplexity",
      companyName: TARGET,
      normalizedName: "junk removal woodbridge",
      position: 2,
      context: "Local option for residential cleanouts in the Woodbridge / Dale City corridor.",
      isTargetBrand: true,
      sources: perplexitySources,
      relevantSources: [perplexitySources[0]!],
    },
    {
      runId: RUN_JUL_21,
      runAt: AT_JUL_21,
      engine: "chatgpt",
      companyName: COMPANIES.kBrooks,
      normalizedName: "k brooks junk removal",
      position: 1,
      context: "Locally owned with strong reviews for furniture and estate cleanouts.",
      isTargetBrand: false,
      sources: chatgptSources,
      relevantSources: [chatgptSources[0]!],
    },
    {
      runId: RUN_JUL_21,
      runAt: AT_JUL_21,
      engine: "chatgpt",
      companyName: COMPANIES.junkluggers,
      normalizedName: "the junkluggers of woodbridge va",
      position: 2,
      context: "Eco-friendly franchise serving Woodbridge VA.",
      isTargetBrand: false,
      sources: chatgptSources,
      relevantSources: [chatgptSources[1]!],
    },
    {
      runId: RUN_JUL_21,
      runAt: AT_JUL_21,
      engine: "gemini",
      companyName: COMPANIES.nova,
      normalizedName: "nova junk",
      position: 3,
      context: null,
      isTargetBrand: false,
      sources: geminiSources,
      relevantSources: [],
    },
    {
      runId: RUN_JUL_16,
      runAt: AT_JUL_16,
      engine: "perplexity",
      companyName: TARGET,
      normalizedName: "junk removal woodbridge",
      position: 3,
      context: "Mentioned among Woodbridge junk removal options.",
      isTargetBrand: true,
      sources: perplexitySources,
      relevantSources: [perplexitySources[0]!],
    },
    {
      runId: RUN_JUL_13,
      runAt: AT_JUL_13,
      engine: "perplexity",
      companyName: TARGET,
      normalizedName: "junk removal woodbridge",
      position: 2,
      context: "Listed near the top of local recommendations.",
      isTargetBrand: true,
      sources: perplexitySources,
      relevantSources: [perplexitySources[0]!],
    },
  ],
};
