import type { ReputationAlertsData } from "@/lib/reputation/alerts-data";
import type { ReputationModulesAuditData } from "@/lib/reputation/reputation-modules-audit";

export const REPUTATION_PREVIEW_BUSINESS_ID = "preview-reputation-intelligence";
export const REPUTATION_PREVIEW_BUSINESS_NAME = "A-Team Junk Removal";

export type ReputationTemplateRow = {
  id: string;
  channel: "sms" | "email" | "sequence";
  name: string;
  subject?: string | null;
  body: string;
  snippet: string;
  type: string;
  lastUpdated: string;
  usageCount: number;
  conversionPct: number | null;
  isDefault?: boolean;
  status?: "active" | "archived";
  source?: "business" | "industry";
  steps?: number;
};

export const reputationTemplatesPreviewData: ReputationTemplateRow[] = [
  {
    id: "tpl-sms-default",
    channel: "sms",
    name: "Post-job SMS request",
    body: "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you share honest feedback? {{review_link}} Reply STOP to opt out.",
    snippet: "Hi {{first_name}}, thanks for choosing {{business_name}}...",
    type: "Service complete",
    lastUpdated: "2026-07-18T15:20:00.000Z",
    usageCount: 842,
    conversionPct: 18.4,
    isDefault: true,
    status: "active",
    source: "business",
  },
  {
    id: "tpl-email-followup",
    channel: "email",
    name: "Friendly email follow-up",
    subject: "How did we do, {{first_name}}?",
    body: "Hi {{first_name}},\n\nThank you for trusting {{business_name}} with your project. Your feedback helps neighbors choose confidently:\n{{review_link}}\n\nThanks again,\n{{business_name}}",
    snippet: "Thank you for trusting {{business_name}} with your project...",
    type: "Email follow-up",
    lastUpdated: "2026-07-12T11:05:00.000Z",
    usageCount: 496,
    conversionPct: 14.9,
    status: "active",
    source: "business",
  },
  {
    id: "tpl-seq-two-step",
    channel: "sequence",
    name: "Two-step service recovery",
    body: "SMS day 1, email day 3, reminder day 7 for completed jobs without a review.",
    snippet: "SMS day 1, email day 3, reminder day 7...",
    type: "Sequence",
    lastUpdated: "2026-07-09T09:30:00.000Z",
    usageCount: 324,
    conversionPct: 21.1,
    status: "active",
    source: "business",
    steps: 3,
  },
  {
    id: "tpl-industry-junk",
    channel: "sms",
    name: "Junk removal starter",
    body: "Hi {{first_name}}, thanks for letting {{business_name}} clear the space. Could you leave a quick Google review? {{review_link}}",
    snippet: "Thanks for letting {{business_name}} clear the space...",
    type: "Industry starter",
    lastUpdated: "2026-06-28T17:10:00.000Z",
    usageCount: 128,
    conversionPct: 16.2,
    status: "active",
    source: "industry",
  },
  {
    id: "tpl-archived",
    channel: "email",
    name: "Legacy review ask",
    subject: "Review request",
    body: "Please review us here: {{review_link}}",
    snippet: "Please review us here: {{review_link}}",
    type: "Archived",
    lastUpdated: "2026-05-14T12:00:00.000Z",
    usageCount: 74,
    conversionPct: 7.6,
    status: "archived",
    source: "business",
  },
];

export type ReputationContactPreviewRow = {
  id: string;
  customer_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  email_normalized: string | null;
  sms_opt_out: boolean;
  email_unsubscribed: boolean;
  tags: string[];
  source?: string | null;
  last_contacted_at?: string | null;
  campaign_attempts?: number | null;
  latest_reply_at?: string | null;
  review_completion?: unknown;
  created_at?: string;
  updated_at: string;
  last_service_at?: string | null;
};

export const reputationContactsPreviewData: ReputationContactPreviewRow[] = [
  {
    id: "contact-1",
    customer_name: "Sam Rivera",
    first_name: "Sam",
    last_name: "Rivera",
    phone_e164: "+14155550118",
    email_normalized: "sam.rivera@example.com",
    sms_opt_out: false,
    email_unsubscribed: false,
    tags: ["vip", "repeat", "review_requested"],
    source: "Jobber",
    last_contacted_at: "2026-07-20T16:15:00.000Z",
    campaign_attempts: 2,
    updated_at: "2026-07-20T16:15:00.000Z",
    last_service_at: "2026-07-18T10:00:00.000Z",
  },
  {
    id: "contact-2",
    customer_name: "Maya Chen",
    first_name: "Maya",
    last_name: "Chen",
    phone_e164: "+14155550192",
    email_normalized: "maya.chen@example.com",
    sms_opt_out: false,
    email_unsubscribed: false,
    tags: ["eligible", "apartment"],
    source: "CSV Import",
    campaign_attempts: 0,
    updated_at: "2026-07-19T12:00:00.000Z",
    last_service_at: "2026-07-19T09:30:00.000Z",
  },
  {
    id: "contact-3",
    customer_name: "Owen Patel",
    first_name: "Owen",
    last_name: "Patel",
    phone_e164: "+14155550234",
    email_normalized: "owen.patel@example.com",
    sms_opt_out: false,
    email_unsubscribed: false,
    tags: ["reviewed", "google"],
    source: "Housecall Pro",
    last_contacted_at: "2026-07-12T15:30:00.000Z",
    campaign_attempts: 1,
    review_completion: { rating: 5 },
    updated_at: "2026-07-13T08:00:00.000Z",
    last_service_at: "2026-07-11T14:20:00.000Z",
  },
  {
    id: "contact-4",
    customer_name: "Nina Brooks",
    first_name: "Nina",
    last_name: "Brooks",
    phone_e164: null,
    email_normalized: "nina.brooks@example.com",
    sms_opt_out: true,
    email_unsubscribed: true,
    tags: ["opted_out"],
    source: "Manual",
    campaign_attempts: 1,
    updated_at: "2026-07-03T10:00:00.000Z",
    last_service_at: "2026-06-29T11:15:00.000Z",
  },
  {
    id: "contact-5",
    customer_name: "Leo Martinez",
    first_name: "Leo",
    last_name: "Martinez",
    phone_e164: "+14155550321",
    email_normalized: null,
    sms_opt_out: false,
    email_unsubscribed: false,
    tags: ["eligible", "same-day"],
    source: "Website",
    campaign_attempts: 0,
    updated_at: "2026-07-21T13:10:00.000Z",
    last_service_at: "2026-07-21T13:10:00.000Z",
  },
];

export type ReputationAutomationPreviewData = {
  metrics: {
    active: number;
    fired30d: number;
    enrolled: number;
    reviewsGenerated: number;
    successPct: number;
  };
  triggers: Array<{
    id: string;
    name: string;
    source: string;
    campaign: string;
    status: "Active" | "Paused" | "Test";
    lastFired: string | null;
    enrolled: number;
  }>;
  activities: Array<{ id: string; title: string; detail: string; at: string; tone?: "green" | "amber" | "red" }>;
  integrations: Array<{ id: string; name: string; status: "Connected" | "Available"; detail: string }>;
};

export const reputationAutomationsPreviewData: ReputationAutomationPreviewData = {
  metrics: {
    active: 7,
    fired30d: 1284,
    enrolled: 946,
    reviewsGenerated: 112,
    successPct: 97.8,
  },
  triggers: [
    {
      id: "auto-1",
      name: "Job completed -> SMS review request",
      source: "Jobber webhook",
      campaign: "Post-job 2-step request",
      status: "Active",
      lastFired: "2026-07-23T18:14:00.000Z",
      enrolled: 482,
    },
    {
      id: "auto-2",
      name: "Invoice paid -> Email follow-up",
      source: "QuickBooks",
      campaign: "Friendly email follow-up",
      status: "Active",
      lastFired: "2026-07-23T15:42:00.000Z",
      enrolled: 217,
    },
    {
      id: "auto-3",
      name: "CSV import -> Re-activation sequence",
      source: "Bulk import",
      campaign: "Winback review request",
      status: "Test",
      lastFired: "2026-07-22T11:09:00.000Z",
      enrolled: 83,
    },
  ],
  activities: [
    { id: "act-1", title: "42 contacts enrolled", detail: "Post-job 2-step request", at: "12 min ago", tone: "green" },
    { id: "act-2", title: "Webhook test succeeded", detail: "Jobber payload mapping verified", at: "2 hr ago", tone: "green" },
    { id: "act-3", title: "3 duplicates suppressed", detail: "Duplicate window protected recent contacts", at: "Yesterday", tone: "amber" },
  ],
  integrations: [
    { id: "int-1", name: "Jobber", status: "Connected", detail: "service.completed events" },
    { id: "int-2", name: "Zapier", status: "Connected", detail: "2 active zaps" },
    { id: "int-3", name: "Make", status: "Available", detail: "Webhook template ready" },
  ],
};

export const reputationAlertsPreviewData: ReputationAlertsData = {
  businessId: REPUTATION_PREVIEW_BUSINESS_ID,
  businessName: REPUTATION_PREVIEW_BUSINESS_NAME,
  activeAlerts: [
    {
      id: "alert-1",
      source: "synthesized",
      category: "unanswered_negative",
      severity: "critical",
      title: "2-star review needs a response",
      body: "Customer mentioned missed arrival window and damaged hallway paint.",
      recommendedAction: "Reply today, apologize for the missed window, and offer a direct resolution.",
      status: "active",
      createdAt: "2026-07-23T13:12:00.000Z",
      resolvedAt: null,
    },
    {
      id: "alert-2",
      source: "persisted",
      category: "velocity_drop",
      severity: "medium",
      title: "Review velocity dipped below competitor pace",
      body: "You gained 6 reviews in 30 days while the local benchmark gained 11.",
      recommendedAction: "Launch a short review request cohort for jobs completed in the last 14 days.",
      status: "active",
      createdAt: "2026-07-21T10:00:00.000Z",
      resolvedAt: null,
    },
    {
      id: "alert-3",
      source: "persisted",
      category: "campaign_delivery_problem",
      severity: "low",
      title: "SMS delivery failures rose above normal",
      body: "Carrier filtering increased on one campaign template.",
      recommendedAction: "Shorten the message and avoid promotional language.",
      status: "active",
      createdAt: "2026-07-19T16:45:00.000Z",
      resolvedAt: null,
    },
  ],
  resolvedAlerts: [
    {
      id: "alert-4",
      source: "persisted",
      category: "response_overdue",
      severity: "medium",
      title: "Positive reviews were waiting on replies",
      body: "Four positive reviews had no owner response for more than 10 days.",
      recommendedAction: "Thank the reviewers and mention specific service details.",
      status: "resolved",
      createdAt: "2026-06-28T12:00:00.000Z",
      resolvedAt: "2026-07-02T09:20:00.000Z",
    },
  ],
  preferences: {
    every_new_review: true,
    low_rating_only: false,
    unanswered_only: false,
    daily_summary: false,
    weekly_summary: true,
    no_reviews_days: 21,
    email_recipients: ["ops@example.com"],
    velocity_drop: true,
    competitor_velocity_spike: true,
    rating_changed: true,
    response_overdue: true,
    campaign_delivery_problem: true,
    review_gap_widening: true,
    maps_visibility_moved: true,
  },
};

export const reputationAuditPreviewData: ReputationModulesAuditData = {
  businessId: REPUTATION_PREVIEW_BUSINESS_ID,
  businessName: REPUTATION_PREVIEW_BUSINESS_NAME,
  generatedAt: "2026-07-24T02:00:00.000Z",
  analytics: {
    businessId: REPUTATION_PREVIEW_BUSINESS_ID,
    businessName: REPUTATION_PREVIEW_BUSINESS_NAME,
    timezone: "America/Los_Angeles",
    lastSyncedAt: "2026-07-23T20:00:00.000Z",
    groupModes: ["daily", "weekly", "monthly"],
    competitors: [
      { id: "comp-1", name: "Standout Trash" },
      { id: "comp-2", name: "All Star Junk" },
    ],
    timelinePoints: [
      { date: "2026-05-01", you: 4, competitorAvg: 3, events: [] },
      { date: "2026-05-15", you: 7, competitorAvg: 5, events: [] },
      { date: "2026-06-01", you: 9, competitorAvg: 7, events: [] },
      { date: "2026-06-15", you: 12, competitorAvg: 8, events: [] },
      { date: "2026-07-01", you: 17, competitorAvg: 10, events: [] },
      { date: "2026-07-15", you: 22, competitorAvg: 12, events: [] },
    ],
    timelineByCompetitor: { "comp-1": [3, 5, 7, 8, 10, 12] },
    timelineEvents: [],
    weeklyVelocity: 5.6,
    monthlyVelocity: 24,
    rolling7d: 8,
    rolling30d: 34,
    rolling60d: 58,
    rolling90d: 82,
    rollingPeriods: [
      { days: 7, current: 8, previous: 6, delta: 2, deltaPct: 33.3 },
      { days: 30, current: 34, previous: 24, delta: 10, deltaPct: 41.7 },
      { days: 60, current: 58, previous: 44, delta: 14, deltaPct: 31.8 },
      { days: 90, current: 82, previous: 63, delta: 19, deltaPct: 30.2 },
    ],
    priorPeriod: {
      rolling7d: 6,
      rolling30d: 24,
      rolling60d: 44,
      rolling90d: 63,
      rolling7dDelta: 2,
      rolling30dDelta: 10,
      rolling60dDelta: 14,
      rolling90dDelta: 19,
      weeklyVelocityDelta: 1.2,
      monthlyVelocityDelta: 8,
    },
    responseRate: 84,
    avgResponseTimeDays: 1.8,
    avgDaysBetweenReviews: 1.1,
    medianDaysBetweenReviews: 1,
    longestDroughtDays: 5,
    activeStreakDays: 17,
    accelerationPct: 41.7,
    momentumStatus: "Accelerating",
    momentumLabel: "Accelerating",
    drivers: ["34 reviews in 30 days", "Ahead of competitor average (34 vs 22)", "Response rate above 80%"],
    explanation: "Review velocity is accelerating and response coverage is strong, but competitor volume still requires weekly consistency.",
    competitorRelative: "Ahead of local 30-day benchmark",
  },
  competitors: {
    businessId: REPUTATION_PREVIEW_BUSINESS_ID,
    businessName: REPUTATION_PREVIEW_BUSINESS_NAME,
    leaderboardRows: [
      { id: REPUTATION_PREVIEW_BUSINESS_ID, name: REPUTATION_PREVIEW_BUSINESS_NAME, isYou: true, totalReviews: 327, rating: 4.6, reviews30: 34, reviews60: 58, reviews90: 82, reviewsPerMonth: 24, momentumLabel: "Accelerating", responseRate: 84, responseSpeedDaysAvg: 1.8 },
      { id: "comp-1", name: "Standout Trash", isYou: false, totalReviews: 391, rating: 4.5, reviews30: 22, reviews60: 44, reviews90: 69, reviewsPerMonth: 18, momentumLabel: "Stable", responseRate: 63, responseSpeedDaysAvg: 4.2 },
      { id: "comp-2", name: "All Star Junk", isYou: false, totalReviews: 284, rating: 4.7, reviews30: 18, reviews60: 36, reviews90: 54, reviewsPerMonth: 16, momentumLabel: "Healthy", responseRate: 71, responseSpeedDaysAvg: 3.1 },
    ],
    gapRows: [
      { competitorId: "comp-1", competitorName: "Standout Trash", totalGap: 64, monthlyVelocityGap: -6, neededToCatch: 65, pace3Months: 72, pace6Months: 144, pace12Months: 288, estimatedCatchUp: "11 months", estimatedCatchUpDate: "2027-06-01", estimatedCatchUpMonths: 11, warning: null, gapExpanding: false },
      { competitorId: "comp-2", competitorName: "All Star Junk", totalGap: 0, monthlyVelocityGap: -8, neededToCatch: 0, pace3Months: 72, pace6Months: 144, pace12Months: 288, estimatedCatchUp: "Already ahead", estimatedCatchUpDate: null, estimatedCatchUpMonths: 0, warning: null, gapExpanding: false },
    ],
    complaintPatterns: [
      { theme: "Scheduling", competitorMentions: 18, yourMentions: 7, gap: 11 },
      { theme: "Pricing clarity", competitorMentions: 13, yourMentions: 5, gap: 8 },
    ],
    positioningOpportunities: [
      { title: "Position around punctual arrival windows", description: "Competitors are criticized for missed windows. Highlight same-day updates in replies and campaigns.", sourceTheme: "Scheduling" },
      { title: "Use transparent pricing language", description: "Mention upfront estimates and no-surprise pricing in owner responses.", sourceTheme: "Pricing clarity" },
    ],
    strengths: {
      positive: [{ label: "Professional crew", count: 89 }, { label: "Fast removal", count: 72 }],
      negative: [{ label: "Arrival window", count: 7 }, { label: "Quote clarity", count: 5 }],
      competitorPositive: [{ label: "Low price", count: 61 }],
      competitorNegative: [{ label: "Scheduling", count: 18 }, { label: "Communication", count: 14 }],
      serviceGaps: [{ label: "Estate cleanout", yourMentions: 14, competitorMentions: 28, gap: 14 }],
      frequentlyPraisedServices: [{ term: "garage cleanout", count: 42 }, { term: "furniture removal", count: 31 }],
      frequentlyMentionedEmployees: [{ term: "Carlos", count: 18 }, { term: "Bree", count: 15 }],
    },
    contentComparison: {
      you: { avgLength: 142, pctWithText: 88, locationTerms: 44, serviceTerms: 76, employeeMentions: 33, pctGeneric: 11, pctDetailed: 72 },
      competitors: { avgLength: 118, pctWithText: 79, locationTerms: 31, serviceTerms: 62, employeeMentions: 20, pctGeneric: 24, pctDetailed: 55 },
    },
  },
  insights: {
    businessId: REPUTATION_PREVIEW_BUSINESS_ID,
    businessName: REPUTATION_PREVIEW_BUSINESS_NAME,
    metrics: {
      positiveThemeMentions: 215,
      negativeThemeMentions: 18,
      totalReviewText: 286,
      avgReviewLength: 142,
      reviewsWithPhotos: 37,
      employeeMentions: 33,
    },
    themes: {
      positive: [{ label: "Professional crew", count: 89, pct: 27 }, { label: "Fast removal", count: 72, pct: 22 }, { label: "Careful cleanup", count: 54, pct: 16 }],
      negative: [{ label: "Arrival window", count: 7, pct: 2 }, { label: "Quote clarity", count: 5, pct: 1.5 }],
      emerging: [{ label: "Same-day availability", count: 19, pct: 6, delta: 8 }, { label: "Donation handling", count: 11, pct: 3, delta: 5 }],
      themeFrequencyOverTime: [{ label: "Professional crew", recent30: 24, prior30: 16, delta: 8 }],
      competitorThemes: [{ label: "Scheduling", yourCount: 7, competitorCount: 18, competitorAvg: 9, gap: 11 }],
    },
    servicesAndKeywords: [{ keyword: "garage cleanout", count: 42 }, { keyword: "furniture removal", count: 31 }],
    categorizedKeywords: {
      services: [{ keyword: "garage cleanout", count: 42 }],
      cities: [{ keyword: "Oakland", count: 18 }],
      employees: [{ keyword: "Carlos", count: 18 }],
      pricing: [{ keyword: "fair price", count: 22 }],
      speed: [{ keyword: "same day", count: 19 }],
      communication: [{ keyword: "text updates", count: 16 }],
    },
    responsePerformance: {
      responseRate: 84,
      totalWithText: 286,
      answered: 240,
      unansweredPositive: 18,
      unansweredNegative: 3,
      unansweredNeutral: 5,
      avgResponseTimeDays: 1.8,
      positiveResponseRate: 87,
      negativeResponseRate: 72,
      oldestUnansweredAt: "2026-07-08T12:00:00.000Z",
      oldestUnansweredDays: 16,
    },
    responseQuality: {
      genericResponseSuspected: 14,
      genericResponsePct: 6,
      qualitySummary: {
        personalizedPct: 78,
        genericPct: 6,
        copyPastePct: 8,
        defensiveCount: 2,
        addressesIssuePct: 82,
        offersResolutionPct: 64,
      },
      rows: [],
    },
  },
  alerts: reputationAlertsPreviewData,
  mapsVisibility: {
    latestScanId: "scan-preview-82",
    latestFinishedAt: "2026-07-22T19:00:00.000Z",
    latestStatus: "completed",
    scanCount30d: 6,
    gridSize: 49,
    summary: "Top-3 visibility improved on 62% of tracked cells after recent review gains.",
    aggregateMetrics: { avgRank: 5.1, top3Pct: 62, top10Pct: 88 },
  },
  campaignCohorts: [
    { campaignId: "camp-1", name: "Post-job 2-step request", status: "active", startedAt: "2026-06-20T12:00:00.000Z", createdAt: "2026-06-19T12:00:00.000Z", sentCount: 842, failedCount: 18, attributedCount: 112, confirmedCount: 82, likelyCount: 30 },
    { campaignId: "camp-2", name: "Friendly email follow-up", status: "active", startedAt: "2026-06-28T12:00:00.000Z", createdAt: "2026-06-27T12:00:00.000Z", sentCount: 496, failedCount: 9, attributedCount: 74, confirmedCount: 51, likelyCount: 23 },
  ],
  recommendedActions: {
    days30: ["Reply to 3 unanswered negative reviews.", "Launch a review request cohort for the last 14 days of completed jobs."],
    days60: ["Close the review gap vs Standout Trash by sustaining 24+ reviews per month.", "Rewrite response snippets to emphasize arrival-window updates."],
    days90: ["Refresh Maps visibility scans monthly and connect gains to review velocity.", "Build a competitor-gap report for the top three service areas."],
  },
};
