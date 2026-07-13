export const LOCAL_TRUST_PREVIEW_BUSINESS_ID = "preview-local-trust";

const now = new Date().toISOString();

function opp(
  id: string,
  overrides: {
    title: string;
    domain: string;
    opportunity_type: string;
    displayGroup: string;
    priority?: string;
    difficulty?: string;
    relevance_score?: number;
    authority_score?: number;
    city_match?: boolean;
    county_match?: boolean;
    competitor_present?: boolean;
    suggested_action?: string;
    evidence_snippet?: string;
    market_city?: string;
    market_state?: string;
  }
) {
  return {
    id,
    title: overrides.title,
    url: `https://${overrides.domain}/`,
    domain: overrides.domain,
    opportunity_type: overrides.opportunity_type,
    priority: overrides.priority ?? "high",
    difficulty: overrides.difficulty ?? "easy",
    relevance_score: overrides.relevance_score ?? 82,
    authority_score: overrides.authority_score ?? 74,
    city_match: overrides.city_match ?? true,
    county_match: overrides.county_match ?? true,
    competitor_present: overrides.competitor_present ?? false,
    suggested_action:
      overrides.suggested_action ?? "Submit membership/sponsorship inquiry with NAP-consistent details.",
    evidence_snippet:
      overrides.evidence_snippet ??
      "Local members and sponsors are listed on this page with contact details for inquiries.",
    market_city: overrides.market_city ?? "Woodbridge",
    market_state: overrides.market_state ?? "VA",
    raw_json: {
      displayGroup: overrides.displayGroup,
      verification: {
        nextAction: overrides.suggested_action ?? "Reach out with a short local sponsorship note.",
      },
    },
  };
}

const opportunities = [
  opp("lt-1", {
    title: "Prince William Chamber — Member Directory",
    domain: "pwchamber.org",
    opportunity_type: "chamber",
    displayGroup: "civic_membership",
    relevance_score: 91,
    authority_score: 78,
    competitor_present: true,
    suggested_action: "Apply for chamber membership and request directory listing.",
  }),
  opp("lt-2", {
    title: "Woodbridge Rotary Club Sponsors",
    domain: "woodbridgerotary.org",
    opportunity_type: "community_event",
    displayGroup: "local_sponsorship",
    relevance_score: 86,
    difficulty: "medium",
    suggested_action: "Offer event sponsorship for community cleanup day.",
  }),
  opp("lt-3", {
    title: "Occoquan River Cleanup Partners",
    domain: "friendsoftheoccoquan.org",
    opportunity_type: "cleanup_event",
    displayGroup: "cleanup_environmental",
    priority: "medium",
    relevance_score: 79,
    authority_score: 61,
    competitor_present: true,
    suggested_action: "Volunteer a crew and ask for partner logo placement.",
  }),
  opp("lt-4", {
    title: "Prince William County Vendor Registration",
    domain: "pwcva.gov",
    opportunity_type: "vendor_list",
    displayGroup: "vendor_registration",
    priority: "high",
    difficulty: "hard",
    relevance_score: 88,
    authority_score: 92,
    suggested_action: "Complete vendor registration for junk removal services.",
  }),
  opp("lt-5", {
    title: "Lake Ridge Community Association Resources",
    domain: "lakeridgeva.com",
    opportunity_type: "hoa_vendor",
    displayGroup: "local_sponsorship",
    priority: "medium",
    difficulty: "easy",
    relevance_score: 74,
    authority_score: 55,
    county_match: false,
    competitor_present: true,
    suggested_action: "Ask to be added to preferred vendor resources page.",
  }),
  opp("lt-6", {
    title: "Northern Virginia Home Services Directory",
    domain: "novahomeservices.example",
    opportunity_type: "local_directory",
    displayGroup: "civic_membership",
    priority: "low",
    relevance_score: 63,
    authority_score: 48,
    suggested_action: "Claim free listing and verify Woodbridge service area.",
  }),
  opp("lt-7", {
    title: "Freedom High School Booster Sponsors",
    domain: "freedomhsboosters.org",
    opportunity_type: "school_sponsor",
    displayGroup: "local_sponsorship",
    priority: "medium",
    relevance_score: 71,
    difficulty: "easy",
    competitor_present: true,
    suggested_action: "Sponsor team banners and request website recognition.",
  }),
  opp("lt-8", {
    title: "Woodbridge Town Cleanup Day Partners",
    domain: "woodbridgeva.gov",
    opportunity_type: "city_county",
    displayGroup: "cleanup_environmental",
    priority: "high",
    relevance_score: 84,
    authority_score: 80,
    suggested_action: "Join as an official cleanup partner for the next event.",
  }),
];

export const localTrustPreviewMain = {
  run: {
    id: "run-preview-local-trust",
    status: "ready",
    city: "Woodbridge",
    county: "Prince William",
    state: "VA",
    keyword: "junk removal",
    scan_type: "initial",
    opportunities_found: opportunities.length,
    high_priority_count: opportunities.filter((o) => o.priority === "high").length,
    local_relevance_score: 84,
    easy_wins_count: opportunities.filter((o) => o.difficulty === "easy").length,
    ai_summary:
      "Woodbridge has strong chamber and civic pages with room for sponsorship mentions. Prioritize Prince William Chamber membership, county vendor registration, and two cleanup partnerships where competitors already appear.",
    progress_stage: null,
    error_message: null,
    created_at: now,
    filtered_out_count: 14,
    rescan_summary_json: null,
  },
  opportunities,
  tasks: [
    {
      id: "task-1",
      title: "Join Prince William Chamber",
      description: "Complete membership application and send NAP details for directory listing.",
      priority: "high",
      impact: "high",
      effort: "medium",
      status: "in_progress",
      due_date: "2026-07-20",
    },
    {
      id: "task-2",
      title: "Register as county vendor",
      description: "Submit junk removal vendor registration on PWC site.",
      priority: "high",
      impact: "high",
      effort: "hard",
      status: "open",
      due_date: "2026-07-28",
    },
    {
      id: "task-3",
      title: "Sponsor Occoquan cleanup",
      description: "Offer a crew for river cleanup and request partner logo placement.",
      priority: "medium",
      impact: "medium",
      effort: "low",
      status: "open",
      due_date: "2026-08-05",
    },
    {
      id: "task-4",
      title: "Claim HOA resource listing",
      description: "Email Lake Ridge association for preferred vendor page inclusion.",
      priority: "medium",
      impact: "medium",
      effort: "easy",
      status: "complete",
      due_date: "2026-07-01",
    },
    {
      id: "task-5",
      title: "Booster club sponsorship kit",
      description: "Prepare one-page sponsorship offer for Freedom HS boosters.",
      priority: "low",
      impact: "low",
      effort: "easy",
      status: "open",
      due_date: "2026-08-12",
    },
  ],
  searchQueries: [
    "Woodbridge VA chamber of commerce member directory",
    "Prince William County business association sponsors",
    "Woodbridge rotary club sponsorship",
    "junk removal sponsor school boosters Woodbridge",
    "Occoquan river cleanup partners Virginia",
    "Prince William County vendor registration list",
    "Lake Ridge HOA preferred vendors",
    "Woodbridge community event sponsors directory",
    "Northern Virginia local business directory junk removal",
    "city of Woodbridge cleanup day partners",
    "county recycling event sponsors Prince William",
    "local charity sponsor pages Woodbridge VA",
  ],
  aiJson: {
    quick_wins: [
      "Claim chamber directory listing this week",
      "Join Woodbridge cleanup partner roster",
      "Submit HOA preferred-vendor request",
    ],
    rejected_opportunities: [
      {
        title: "National Franchise Partner Hub",
        url: "https://nationalfranchise.example/partners",
        domain: "nationalfranchise.example",
        stage: "snippet_filter",
        reason: "National franchise list with no Woodbridge or Prince William locality signals.",
        confidence: 22,
        localRelevance: 12,
      },
      {
        title: "Generic Home Services Blogroll",
        url: "https://homeservicesblog.example/links",
        domain: "homeservicesblog.example",
        stage: "page_verify",
        reason: "Page is a nofollow link dump without civic, sponsorship, or membership intent.",
        confidence: 35,
        localRelevance: 28,
      },
      {
        title: "Out-of-market Fairfax Directory",
        url: "https://fairfaxdir.example/vendors",
        domain: "fairfaxdir.example",
        stage: "page_fetch",
        reason: "Primary market is Fairfax County; weak relevance to Woodbridge service area.",
        confidence: 48,
        localRelevance: 31,
      },
    ],
  },
  marketTotal: opportunities.length,
};

export const localTrustPreviewMarkets = {
  markets: [
    {
      city: "Woodbridge",
      state: "VA",
      county: "Prince William",
      acceptedCount: 8,
      rejectedCount: 14,
      latestRunAt: now,
    },
    {
      city: "Manassas",
      state: "VA",
      county: "Prince William",
      acceptedCount: 5,
      rejectedCount: 9,
      latestRunAt: "2026-07-02T14:00:00.000Z",
    },
    {
      city: "Dale City",
      state: "VA",
      county: "Prince William",
      acceptedCount: 4,
      rejectedCount: 7,
      latestRunAt: "2026-06-28T11:30:00.000Z",
    },
  ],
  suggestions: [
    { city: "Occoquan", state: "VA" },
    { city: "Lorton", state: "VA" },
  ],
};

export const localTrustPreviewRuns = {
  runs: [
    {
      id: "run-1",
      city: "Woodbridge",
      state: "VA",
      county: "Prince William",
      status: "ready",
      scan_type: "initial",
      opportunities_found: 8,
      filtered_out_count: 14,
      created_at: now,
      finished_at: now,
      rescan_summary_json: null,
    },
    {
      id: "run-2",
      city: "Manassas",
      state: "VA",
      county: "Prince William",
      status: "ready",
      scan_type: "rescan",
      opportunities_found: 5,
      filtered_out_count: 9,
      created_at: "2026-07-02T14:00:00.000Z",
      finished_at: "2026-07-02T14:12:00.000Z",
      rescan_summary_json: {
        candidatesFound: 22,
        alreadyKnown: 11,
        previouslyRejected: 6,
        newCandidatesChecked: 5,
        newOpportunitiesAdded: 2,
        marketTotalAccepted: 5,
      },
    },
    {
      id: "run-3",
      city: "Dale City",
      state: "VA",
      county: "Prince William",
      status: "ready",
      scan_type: "initial",
      opportunities_found: 4,
      filtered_out_count: 7,
      created_at: "2026-06-28T11:30:00.000Z",
      finished_at: "2026-06-28T11:42:00.000Z",
      rescan_summary_json: null,
    },
  ],
};

export const localTrustPreviewCounts = {
  counts: [
    { type: "local_sponsorship", count: 3 },
    { type: "civic_membership", count: 2 },
    { type: "cleanup_environmental", count: 2 },
    { type: "vendor_registration", count: 1 },
  ],
};

export function localTrustPreviewOpportunities(url: string) {
  const parsed = new URL(url, "http://localhost");
  const page = Number(parsed.searchParams.get("page") ?? "1");
  const pageSize = Number(parsed.searchParams.get("pageSize") ?? "10");
  const group = parsed.searchParams.get("group");
  const type = parsed.searchParams.get("type");
  const priority = parsed.searchParams.get("priority");
  const competitorPresent = parsed.searchParams.get("competitorPresent") === "true";

  let items = [...opportunities];
  if (group) {
    items = items.filter((o) => String(o.raw_json.displayGroup) === group);
  }
  if (type) {
    items = items.filter((o) => o.opportunity_type === type);
  }
  if (priority) {
    items = items.filter((o) => o.priority === priority);
  }
  if (competitorPresent) {
    items = items.filter((o) => o.competitor_present);
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}
