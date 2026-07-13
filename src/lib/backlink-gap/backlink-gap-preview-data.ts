export const BACKLINK_GAP_PREVIEW_BUSINESS_ID = "preview-backlink-gap";

const competitors = [
  { name: "Junk King", domain: "junkking.com" },
  { name: "College Hunks", domain: "collegehunkshaulingjunk.com" },
  { name: "LoadUp", domain: "goloadup.com" },
];

const context = {
  category: "Junk removal service",
  keyword: "junk removal",
  city: "Woodbridge",
};

function opp(
  id: string,
  domain: string,
  overrides: Partial<{
    priority: string;
    source_type: string;
    power: number;
    dofollow: boolean;
    topical: string;
    status: string;
    competitors: string[];
  }> = {}
) {
  const linked = (overrides.competitors ?? ["Junk King", "College Hunks"]).map((name) => ({
    name,
    domain: competitors.find((c) => c.name === name)?.domain ?? null,
  }));
  return {
    id,
    referring_domain: domain,
    source_url: `https://${domain}/listing`,
    source_title: `${domain} business directory`,
    source_type: overrides.source_type ?? "Directory",
    domain_rank: 42,
    authority_score: overrides.power ?? 68,
    competitor_count: linked.length,
    linked_competitors: linked,
    target_has_link: false,
    anchor_text: "junk removal woodbridge",
    dofollow: overrides.dofollow ?? true,
    first_seen: "2025-11-01",
    last_seen: "2026-06-20",
    opportunity_score: 82,
    priority: overrides.priority ?? "high",
    suggested_action: "Submit business profile and request a featured listing.",
    reason: "Multiple competitors listed; strong local relevance.",
    status: overrides.status ?? "open",
    raw_json: { topical_fit: overrides.topical ?? "topical" },
  };
}

const opportunities = [
  opp("o1", "homeadvisor.com", { power: 88, source_type: "Directory", priority: "high" }),
  opp("o2", "angi.com", { power: 84, source_type: "Directory", priority: "high" }),
  opp("o3", "thumbtack.com", { power: 79, source_type: "Marketplace", priority: "medium" }),
  opp("o4", "yelp.com", { power: 76, source_type: "Review site", priority: "medium" }),
  opp("o5", "bbb.org", { power: 72, source_type: "Directory", priority: "medium" }),
  opp("o6", "localnews.example", { power: 61, source_type: "Local media", priority: "low" }),
  opp("o7", "spamlinks.example", {
    power: 12,
    priority: "ignore",
    status: "spam",
    topical: "random",
    dofollow: false,
  }),
];

export const backlinkGapPreviewMain = {
  run: {
    id: "run-preview-gap",
    status: "ready",
    target_domain: "junkremovalwoodbridge.com",
    target_ref_domain_count: 84,
    competitor_ref_domain_count: 312,
    missing_opportunity_count: 47,
    high_priority_count: 12,
    ai_summary:
      "Your competitors are well represented on local directories and home-services marketplaces where you are missing. Prioritize HomeAdvisor, Angi, and Thumbtack — all pass dofollow equity and show strong topical fit for junk removal in Woodbridge.",
    progress_stage: null,
    error_message: null,
    selected_competitors: competitors,
    created_at: new Date().toISOString(),
  },
  tasks: [
    {
      id: "t1",
      title: "Claim HomeAdvisor profile",
      description: "Complete business profile and add service area coverage.",
      priority: "high",
      impact: "high",
      effort: "low",
      status: "open",
    },
    {
      id: "t2",
      title: "Submit Angi listing",
      description: "Verify NAP consistency and request editorial review.",
      priority: "high",
      impact: "high",
      effort: "medium",
      status: "in_progress",
    },
    {
      id: "t3",
      title: "Outreach to local chamber",
      description: "Request member directory link from regional chamber site.",
      priority: "medium",
      impact: "medium",
      effort: "medium",
      status: "open",
    },
  ],
  competitors,
  context,
};

export const backlinkGapPreviewStats = {
  linkTypes: { dofollow: 31, nofollow: 11, unknown: 5 },
  priorities: { high: 12, medium: 24, low: 11 },
  sourceTypes: [
    { name: "Directory", count: 18 },
    { name: "Marketplace", count: 11 },
    { name: "Review site", count: 9 },
    { name: "Local media", count: 5 },
    { name: "Chamber", count: 4 },
  ],
  powerBuckets: [
    { label: "0-10", count: 2 },
    { label: "11-20", count: 3 },
    { label: "21-30", count: 4 },
    { label: "31-40", count: 5 },
    { label: "41-50", count: 6 },
    { label: "51-60", count: 7 },
    { label: "61-70", count: 9 },
    { label: "71-80", count: 6 },
    { label: "81-90", count: 4 },
    { label: "91-100", count: 1 },
  ],
  relevance: { high: 22, medium: 18, low: 7 },
  matrixDistribution: {
    total: 312,
    sharedByAll: 48,
    sharedBySome: 96,
    exclusive: 84,
    onlyToYou: 84,
  },
  topCompetitor: { name: "Junk King", domain: "junkking.com", count: 118 },
  ignoredStats: { ignored: 6, spam: 4, restored: 2, review: 3 },
};

export const backlinkGapPreviewMatrix = {
  total: 312,
  rows: [
    {
      domain: "homeadvisor.com",
      authority_score: 88,
      domain_rank: 62,
      source_type: "Directory",
      you: false,
      "Junk King": true,
      "College Hunks": true,
      LoadUp: true,
      competitor_count: 3,
    },
    {
      domain: "angi.com",
      authority_score: 84,
      domain_rank: 58,
      source_type: "Directory",
      you: false,
      "Junk King": true,
      "College Hunks": true,
      LoadUp: false,
      competitor_count: 2,
    },
    {
      domain: "thumbtack.com",
      authority_score: 79,
      domain_rank: 54,
      source_type: "Marketplace",
      you: false,
      "Junk King": true,
      "College Hunks": false,
      LoadUp: true,
      competitor_count: 2,
    },
    {
      domain: "yelp.com",
      authority_score: 76,
      domain_rank: 51,
      source_type: "Review site",
      you: true,
      "Junk King": true,
      "College Hunks": true,
      LoadUp: true,
      competitor_count: 3,
    },
    {
      domain: "woodbridgechamber.org",
      authority_score: 54,
      domain_rank: 38,
      source_type: "Chamber",
      you: false,
      "Junk King": true,
      "College Hunks": false,
      LoadUp: false,
      competitor_count: 1,
    },
  ],
};

export function backlinkGapPreviewOpportunities(url: string) {
  const u = new URL(url, "http://localhost");
  const page = Number(u.searchParams.get("page") ?? "1");
  const pageSize = Number(u.searchParams.get("pageSize") ?? "10");
  const status = u.searchParams.get("status") ?? "open";
  const competitor = u.searchParams.get("competitor");
  const priorityFilter = u.searchParams.get("priorityFilter") ?? "all";

  let items = status === "ignored" ? opportunities.filter((o) => o.status !== "open") : opportunities.filter((o) => o.status === "open");

  if (priorityFilter === "high") {
    items = items.filter((o) => o.priority === "high");
  }

  if (competitor) {
    items = items.filter((o) => o.linked_competitors.some((c) => c.name === competitor));
  }

  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  return {
    items: slice,
    total: items.length,
    context,
  };
}

export const backlinkGapPreviewCounts = {
  counts: competitors.map((c, i) => ({
    name: c.name,
    domain: c.domain,
    count: [18, 14, 11][i] ?? 8,
  })),
};
