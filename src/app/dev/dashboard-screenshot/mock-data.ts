import type { DashboardFeaturedData } from "@/lib/overview/dashboard-featured-types";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";

export const SCREENSHOT_BUSINESS_ID = "screenshot-preview";

function scanRow(
  partial: Partial<DashboardScanRow> & Pick<DashboardScanRow, "id" | "keyword" | "status">
): DashboardScanRow {
  return {
    keywordId: "kw-1",
    finishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    nextRecoveryAt: null,
    gridSize: 7,
    radiusMeters: 1600,
    arp: null,
    solv: null,
    saiv: null,
    change: null,
    ranks: [],
    totalCells: 49,
    completedCells: 0,
    unresolvedCells: 49,
    progressPercent: 0,
    locationLabel: "Woodbridge, VA",
    businessName: "Junk Removal Woodbridge",
    active: false,
    ...partial,
  };
}

export const screenshotScans: DashboardScanRow[] = [
  scanRow({
    id: "scan-1",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    gridSize: 7,
    arp: 4.2,
    solv: 42,
    saiv: 38,
    change: 3.3,
    ranks: Array.from({ length: 49 }, (_, i) => (i % 5 === 0 ? 3 : i % 3 === 0 ? 8 : 14)),
    status: "ready",
    completedCells: 49,
    unresolvedCells: 0,
    progressPercent: 100,
  }),
  scanRow({
    id: "scan-2",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 172800000).toISOString(),
    gridSize: 7,
    arp: 5.1,
    solv: 38,
    saiv: 35,
    change: -2.8,
    ranks: Array.from({ length: 49 }, (_, i) => (i % 4 === 0 ? 5 : i % 2 === 0 ? 11 : 18)),
    status: "ready",
    completedCells: 49,
    unresolvedCells: 0,
    progressPercent: 100,
  }),
  scanRow({
    id: "scan-3",
    keyword: "junk removal woodbridge",
    keywordId: "kw-1",
    finishedAt: new Date(Date.now() - 259200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    completedAt: new Date(Date.now() - 259200000).toISOString(),
    gridSize: 3,
    arp: 6.8,
    solv: 22,
    saiv: 20,
    change: 1.1,
    ranks: [2, 5, 8, 4, 12, 9, 15, 7, 11],
    status: "ready",
    totalCells: 9,
    completedCells: 9,
    unresolvedCells: 0,
    progressPercent: 100,
  }),
];

/** Representative layout data — mirrors live dashboard structure (2 recent reviews, rich cards). */
export const screenshotFeatured: DashboardFeaturedData = {
  review: {
    rating: 5.0,
    totalReviews: 127,
    newReviews90d: 2,
    responseRate: 68,
    momentumLabel: "Accelerating",
    weeklyPaceGap: 1.5,
    yourSharePct: 24,
    top3SharePct: 58,
    trend: [0, 1, 1, 2, 1, 2],
    latestReviews: [
      {
        reviewerName: "Sarah M.",
        rating: 5,
        reviewText:
          "They showed up on time and cleared out our entire garage in under two hours. Super professional crew and fair pricing.",
        relativeDate: "2 weeks ago",
        replied: false,
      },
      {
        reviewerName: "James T.",
        rating: 5,
        reviewText:
          "Best junk removal in Woodbridge. Hauled away old furniture same day I called. Will definitely use again.",
        relativeDate: "1 month ago",
        replied: true,
      },
    ],
    topCompetitor: {
      name: "Junk King",
      reviews30d: 14,
      rating: 4.9,
    },
    hasData: true,
  },
  ai: {
    hasData: true,
    visibilityScore: 42,
    lastRunAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    targetMentioned: true,
    engines: [
      { engine: "chatgpt", label: "ChatGPT", mentioned: true },
      { engine: "gemini", label: "Gemini", mentioned: true },
      { engine: "claude", label: "Claude", mentioned: false },
      { engine: "perplexity", label: "Perplexity", mentioned: false },
    ],
    mentions: [
      { name: "Junk King", sharePct: 28, engineCount: 4, isTarget: false },
      { name: "College Hunks Hauling Junk", sharePct: 22, engineCount: 3, isTarget: false },
      { name: "Junk Removal Woodbridge", sharePct: 18, engineCount: 2, isTarget: true },
      { name: "1-800-GOT-JUNK?", sharePct: 12, engineCount: 2, isTarget: false },
      { name: "LoadUp", sharePct: 8, engineCount: 1, isTarget: false },
      { name: "Waste Management", sharePct: 6, engineCount: 1, isTarget: false },
    ],
    companyCount: 39,
    primaryPrompt: "Who is the best junk removal company in Woodbridge, VA?",
  },
  local: {
    hasData: true,
    items: [
      {
        id: "1",
        title: "Prince William Chamber of Commerce",
        opportunityType: "Chamber Membership",
        priority: "high",
        suggestedAction: "Apply for business membership and sponsor the annual golf outing",
        evidenceSnippet:
          "Listed sponsors include two direct competitors. Chamber directory ranks on page 1 for 'woodbridge business directory'.",
        domain: "pwchamber.org",
      },
      {
        id: "2",
        title: "Tunnel to Towers Foundation",
        opportunityType: "Community Sponsorship",
        priority: "high",
        suggestedAction: "Sponsor a local 5K run booth or in-kind junk haul for event cleanup",
        evidenceSnippet:
          "Annual Woodbridge run draws 800+ attendees. No junk removal sponsor listed for 2025.",
        domain: "tunnel2towers.org",
      },
      {
        id: "3",
        title: "Woodbridge Little League",
        opportunityType: "Youth Sports Sponsor",
        priority: "medium",
        suggestedAction: "Offer discounted field cleanup and jersey back sponsorship",
        evidenceSnippet: "League website lists HVAC and roofing sponsors but no hauling partner.",
        domain: "woodbridgelittleleague.org",
      },
      {
        id: "4",
        title: "Northern Virginia Vendor List",
        opportunityType: "Vendor Directory",
        priority: "medium",
        suggestedAction: "Submit application as approved residential junk removal vendor",
        evidenceSnippet:
          "County procurement page links approved vendors for estate cleanouts and bulk pickup.",
        domain: "fairfaxcounty.gov",
      },
    ],
    total: 21,
  },
};
