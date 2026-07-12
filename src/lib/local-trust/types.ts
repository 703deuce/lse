export type OpportunityDisplayGroup =
  | "local_sponsorship"
  | "civic_membership"
  | "cleanup_environmental"
  | "vendor_registration";

export const OPPORTUNITY_DISPLAY_GROUP_LABELS: Record<OpportunityDisplayGroup, string> = {
  local_sponsorship: "Local sponsorships",
  civic_membership: "Local civic / membership",
  cleanup_environmental: "Cleanup / environmental partnerships",
  vendor_registration: "Vendor / public contract registration",
};

/** Mockup-facing labels for accordion groups and category charts */
export const MOCKUP_GROUP_LABELS: Record<OpportunityDisplayGroup, string> = {
  local_sponsorship: "Sponsorship",
  civic_membership: "Chamber / Business Association",
  cleanup_environmental: "Cleanup / Environmental",
  vendor_registration: "Vendor / Public Contract",
};

export const DISPLAY_GROUP_ORDER: OpportunityDisplayGroup[] = [
  "local_sponsorship",
  "civic_membership",
  "cleanup_environmental",
  "vendor_registration",
];

export type OpportunityType =
  | "chamber"
  | "local_directory"
  | "local_news"
  | "community_event"
  | "charity"
  | "school_sponsor"
  | "hoa_vendor"
  | "city_county"
  | "vendor_list"
  | "cleanup_event"
  | "industry_local"
  | "other";

export type LocalTrustOpportunity = {
  title: string;
  url: string;
  domain: string;
  opportunityType: OpportunityType;
  cityMatch: boolean;
  countyMatch: boolean;
  topicalMatch: boolean;
  competitorPresent: boolean;
  authorityScore: number;
  relevanceScore: number;
  difficulty: "easy" | "medium" | "hard";
  priority: "high" | "medium" | "low" | "ignore";
  suggestedAction: string;
  evidenceSnippet: string;
  searchQuery: string;
  raw: Record<string, unknown>;
};

export type RejectedOpportunity = {
  title: string;
  url: string;
  domain: string;
  stage: "snippet_filter" | "page_fetch" | "page_verify";
  reason: string;
  opportunityType?: OpportunityType;
  confidence?: number;
  localRelevance?: number;
};

export type LocalTrustRescanSummary = {
  candidatesFound: number;
  alreadyKnown: number;
  previouslyRejected: number;
  alreadyAccepted: number;
  newCandidatesChecked: number;
  newOpportunitiesAdded: number;
  marketTotalAccepted: number;
};

export type LocalTrustRunResult = {
  runId: string;
  status: string;
  scanType: "initial" | "rescan";
  marketCity: string;
  marketState: string;
  marketCounty?: string | null;
  opportunitiesFound: number;
  highPriorityCount: number;
  localRelevanceScore: number;
  easyWinsCount: number;
  aiSummary: string | null;
  opportunities: LocalTrustOpportunity[];
  rejectedOpportunities: RejectedOpportunity[];
  tasks: Array<Record<string, unknown>>;
  searchQueries: string[];
  warnings: string[];
  filteredOutCount?: number;
  rescanSummary?: LocalTrustRescanSummary;
};

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  chamber: "Chamber / business association",
  local_directory: "Local directory",
  local_news: "Local news / blog",
  community_event: "Community event",
  charity: "Charity / nonprofit",
  school_sponsor: "School / sports sponsor",
  hoa_vendor: "HOA / neighborhood resource",
  city_county: "City / county page",
  vendor_list: "Vendor / resource list",
  cleanup_event: "Cleanup / recycling event",
  industry_local: "Industry-local crossover",
  other: "Other",
};

export const TYPE_DISPLAY_ORDER: OpportunityType[] = [
  "chamber",
  "city_county",
  "charity",
  "school_sponsor",
  "community_event",
  "cleanup_event",
  "hoa_vendor",
  "vendor_list",
  "local_directory",
  "local_news",
  "industry_local",
  "other",
];
