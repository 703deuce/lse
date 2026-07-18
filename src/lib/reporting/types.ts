export type ReportType =
  | "single_scan"
  | "competitor"
  | "trend"
  | "location"
  | "keyword"
  | "maps_campaign"
  | "reviews"
  | "review_campaign";

export type WhiteLabelConfig = {
  companyName: string;
  logoUrl?: string | null;
  accentColor?: string | null; // default #059669
  footerText?: string | null;
  hidePlatformBranding?: boolean;
  contactLine?: string | null;
};

export type ReportKpis = {
  arp: number | null; // average rank of found cells
  atrp: number | null; // average total rank treating not-found as 21
  solv: number; // % top-3
  top3Pct: number;
  top10Pct: number;
  notFoundPct: number;
  visibilityScore: number; // top-10 share
  bestRank: number | null;
  worstRank: number | null;
  totalCells: number;
  foundCells: number;
};

export type HeatmapCell = {
  label: string;
  row: number;
  col: number;
  rank: number | null;
  color: string;
  textColor: string;
};

export type ReportCompetitorRow = {
  key: string;
  name: string;
  arp: number | null;
  atrp: number | null;
  solv: number;
  top3Appearances: number;
  totalCells: number;
  appearancePct: number;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
  address?: string | null;
  placeId?: string | null;
  cid?: string | null;
  mapsUrl?: string | null;
  isTarget?: boolean;
};

export type SingleScanReportPayload = {
  reportType: "single_scan";
  business: {
    id: string;
    name: string;
    address: string | null;
    category: string | null;
    rating: number | null;
    reviewCount: number | null;
    placeId: string | null;
    mapsUrl: string | null;
  };
  parameters: {
    keyword: string;
    scannedAt: string;
    gridSize: number;
    radiusMeters: number;
    pointCount: number;
    platform: string;
    centerLabel: string | null;
    scanId: string;
  };
  kpis: ReportKpis;
  heatmap: { gridSize: number; cells: HeatmapCell[] };
  competitors: ReportCompetitorRow[];
  rankDistribution: { label: string; count: number }[];
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
  executiveSummary?: string | null;
  sections?: Partial<Record<string, boolean>> | null;
};

export type TrendReportPayload = {
  reportType: "trend";
  business: { id: string; name: string };
  parameters: {
    keyword: string;
    gridSize: number;
    radiusMeters: number;
    locationId: string | null;
    dateFrom: string;
    dateTo: string;
    scanCount: number;
  };
  series: Array<{
    scanId: string;
    date: string;
    arp: number | null;
    atrp: number | null;
    solv: number | null;
    top3Pct: number | null;
    top10Pct: number | null;
    visibilityScore: number | null;
  }>;
  current: { arp: number | null; atrp: number | null; solv: number | null };
  previous: { arp: number | null; atrp: number | null; solv: number | null };
  deltas: { arp: number | null; atrp: number | null; solv: number | null };
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type CompetitorReportPayload = {
  reportType: "competitor";
  business: { id: string; name: string };
  parameters: {
    keyword: string;
    scannedAt: string;
    gridSize: number;
    radiusMeters: number;
    scanId: string;
  };
  target: ReportCompetitorRow;
  competitors: ReportCompetitorRow[];
  selectedCompetitorKeys: string[];
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type LocationReportPayload = {
  reportType: "location";
  business: { id: string; name: string; address: string | null };
  parameters: { dateFrom: string; dateTo: string; keywordCount: number };
  aggregate: ReportKpis;
  keywords: Array<{
    keyword: string;
    keywordId: string | null;
    scanId: string | null;
    scannedAt: string | null;
    arp: number | null;
    atrp: number | null;
    solv: number | null;
    changeArp: number | null;
  }>;
  rising: string[];
  falling: string[];
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type KeywordReportPayload = {
  reportType: "keyword";
  business: { id: string; name: string; address: string | null };
  parameters: {
    keyword: string;
    keywordId: string | null;
    gridSize: number;
    radiusMeters: number;
    locationCount: number;
    dateFrom: string;
    dateTo: string;
  };
  aggregate: ReportKpis;
  locations: Array<{
    locationId: string | null;
    name: string;
    address: string | null;
    isBusinessLocation: boolean;
    scanId: string | null;
    scannedAt: string | null;
    arp: number | null;
    atrp: number | null;
    solv: number | null;
  }>;
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type MapsCampaignReportPayload = {
  reportType: "maps_campaign";
  business: { id: string; name: string; address: string | null };
  parameters: {
    campaignId?: string | null;
    campaignName?: string | null;
    scheduleEnabled: boolean;
    cronExpression: string | null;
    nextRunAt: string | null;
    lastRunAt: string | null;
    gridSize: number | null;
    radiusMeters: number | null;
    keywordCount: number;
    dateFrom: string;
    dateTo: string;
  };
  aggregate: ReportKpis;
  keywords: Array<{
    keyword: string;
    keywordId: string | null;
    scanId: string | null;
    scannedAt: string | null;
    arp: number | null;
    atrp: number | null;
    solv: number | null;
    changeArp: number | null;
  }>;
  rising: string[];
  falling: string[];
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type ReviewsReportPayload = {
  reportType: "reviews";
  business: { id: string; name: string };
  parameters: {
    runId: string | null;
    runStatus: string | null;
    auditedAt: string | null;
    previousReviews30d: number | null;
  };
  target: {
    name: string;
    rating: number | null;
    totalReviews: number;
    reviews7d: number;
    reviews30d: number;
    reviews90d: number;
    avgReviewsPerWeek: number | null;
    daysSinceLastReview: number | null;
    momentumScore: number | null;
    momentumLabel: string | null;
    gapToTop3_30d: number | null;
    recommendedWeeklyTarget: number | null;
    responseRate: number | null;
    unanswered90d: number | null;
  };
  competitors: Array<{
    name: string;
    rating: number | null;
    totalReviews: number;
    reviews30d: number;
    avgReviewsPerWeek: number | null;
    momentumScore: number | null;
    momentumLabel: string | null;
  }>;
  tasks: Array<{ title: string; description: string | null; priority: string | null }>;
  summary: string | null;
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type ReviewCampaignReportPayload = {
  reportType: "review_campaign";
  business: { id: string; name: string };
  parameters: {
    campaignId: string;
    campaignName: string;
    status: string;
    channel: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  funnel: {
    recipientsTotal: number;
    queued: number;
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
    optedOut: number;
    replied: number;
    sms: number;
    email: number;
  };
  attribution: {
    confirmed: number;
    likely: number;
    unattributed: number;
  };
  rates: {
    deliveryRate: number | null;
    clickRate: number | null;
    replyRate: number | null;
    attributedReviewRate: number | null;
  };
  activity: Array<{ at: string; type: string; label: string; meta?: string }>;
  recipients: Array<{
    name: string;
    status: string;
    channel: string | null;
    repliedAt: string | null;
    reviewDetectedAt: string | null;
  }>;
  whiteLabel: WhiteLabelConfig;
  generatedAt: string;
};

export type AnyReportPayload =
  | SingleScanReportPayload
  | TrendReportPayload
  | CompetitorReportPayload
  | LocationReportPayload
  | KeywordReportPayload
  | MapsCampaignReportPayload
  | ReviewsReportPayload
  | ReviewCampaignReportPayload;
