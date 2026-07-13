export const KEYWORDS_PREVIEW_BUSINESS_ID = "preview-keywords";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function checks(ranks: Array<{ rank: number | null; days: number }>) {
  return ranks.map(({ rank, days }) => ({
    rank,
    rank_bucket: rank == null || rank <= 0 ? "beyond" : rank <= 3 ? "top3" : rank <= 10 ? "top10" : rank <= 20 ? "top20" : "beyond",
    visibility_score:
      rank == null || rank <= 0
        ? 0
        : rank === 1
          ? 100
          : rank === 2
            ? 85
            : rank === 3
              ? 70
              : rank <= 10
                ? 40
                : 15,
    checked_at: daysAgo(days),
  }));
}

const keywordRows = [
  {
    id: "kw-1",
    keyword: "junk removal woodbridge",
    location_name: "Woodbridge, VA, United States",
    search_volume: 720,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 4, days: 0 }])[0],
    rank_change: 2,
    opportunity: 88,
    recent_checks: checks([
      { rank: 7, days: 21 },
      { rank: 6, days: 14 },
      { rank: 5, days: 7 },
      { rank: 4, days: 0 },
    ]),
  },
  {
    id: "kw-2",
    keyword: "junk removal near me",
    location_name: "Woodbridge, VA, United States",
    search_volume: 2400,
    tracking_frequency: "daily",
    active: true,
    latest_check: checks([{ rank: 2, days: 0 }])[0],
    rank_change: 1,
    opportunity: 42,
    recent_checks: checks([
      { rank: 4, days: 14 },
      { rank: 3, days: 7 },
      { rank: 2, days: 0 },
    ]),
  },
  {
    id: "kw-3",
    keyword: "garage cleanout woodbridge va",
    location_name: "Woodbridge, VA, United States",
    search_volume: 210,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 11, days: 1 }])[0],
    rank_change: -1,
    opportunity: 76,
    recent_checks: checks([
      { rank: 9, days: 14 },
      { rank: 10, days: 7 },
      { rank: 11, days: 1 },
    ]),
  },
  {
    id: "kw-4",
    keyword: "furniture removal dale city",
    location_name: "Dale City, VA, United States",
    search_volume: 140,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 8, days: 2 }])[0],
    rank_change: 0,
    opportunity: 61,
    recent_checks: checks([
      { rank: 8, days: 14 },
      { rank: 8, days: 2 },
    ]),
  },
  {
    id: "kw-5",
    keyword: "same day junk pickup",
    location_name: "Woodbridge, VA, United States",
    search_volume: 90,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 1, days: 0 }])[0],
    rank_change: 0,
    opportunity: 18,
    recent_checks: checks([
      { rank: 1, days: 14 },
      { rank: 1, days: 7 },
      { rank: 1, days: 0 },
    ]),
  },
  {
    id: "kw-6",
    keyword: "estate cleanout prince william",
    location_name: "Prince William County, VA, United States",
    search_volume: 110,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: null, days: 3 }])[0],
    rank_change: null,
    opportunity: 92,
    recent_checks: checks([
      { rank: 18, days: 21 },
      { rank: null, days: 3 },
    ]),
  },
  {
    id: "kw-7",
    keyword: "appliance haul away woodbridge",
    location_name: "Woodbridge, VA, United States",
    search_volume: 70,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 6, days: 1 }])[0],
    rank_change: 3,
    opportunity: 55,
    recent_checks: checks([
      { rank: 12, days: 14 },
      { rank: 9, days: 7 },
      { rank: 6, days: 1 },
    ]),
  },
  {
    id: "kw-8",
    keyword: "manassas junk removal",
    location_name: "Manassas, VA, United States",
    search_volume: 320,
    tracking_frequency: "weekly",
    active: true,
    latest_check: checks([{ rank: 14, days: 2 }])[0],
    rank_change: -2,
    opportunity: 79,
    recent_checks: checks([
      { rank: 10, days: 14 },
      { rank: 12, days: 7 },
      { rank: 14, days: 2 },
    ]),
  },
];

export const keywordsPreviewData = {
  keywords: keywordRows,
  suggestions: [
    {
      id: "sug-1",
      keyword: "couch removal woodbridge",
      search_volume: 90,
      intent_type: "service",
      priority: "high",
      reason: "High intent; weak competitor coverage nearby.",
    },
    {
      id: "sug-2",
      keyword: "basement cleanout near me",
      search_volume: 170,
      intent_type: "near_me",
      priority: "medium",
      reason: "Growing local demand in your market.",
    },
  ],
  summary: {
    tracked_count: keywordRows.length,
    avg_rank: 6.6,
    top3_count: 2,
    best_opportunity: {
      keyword: "junk removal woodbridge",
      score: 88,
      keyword_id: "kw-1",
    },
    avg_rank_delta: 1,
    top3_delta: 1,
  },
  market: {
    city: "Woodbridge",
    state: "VA",
    label: "Woodbridge,VA,United States",
    display: "Woodbridge, VA, United States",
    location_code: 1026201,
    level: "city" as const,
    ready: true,
  },
  business: {
    name: "Premier Junk Removal",
    lat: 38.6582,
    lng: -77.2497,
  },
};
