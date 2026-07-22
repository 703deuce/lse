import type { ProspectAuditReport } from "@/lib/prospect-audit/types";
import { rankHex, rankTextColor } from "@/lib/maps/colors";

function makeGrid(size: number, seed: number) {
  const cells = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dist = Math.hypot(row - 1, col - 2);
      let rank: number | null = Math.max(1, Math.round(1 + dist * 3 + ((seed + row * col) % 4)));
      if (rank > 20) rank = null;
      cells.push({
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
        row,
        col,
        rank,
        color: rankHex(rank),
        textColor: rankTextColor(rankHex(rank)),
      });
    }
  }
  return cells;
}

export const PROSPECT_AUDIT_PREVIEW_BUSINESS_ID = "e64dbadd-69bb-4715-a526-6d137c0ae409";

export const prospectAuditPreviewReport: ProspectAuditReport = {
  auditId: "preview-audit-1",
  status: "ready",
  business: {
    id: PROSPECT_AUDIT_PREVIEW_BUSINESS_ID,
    name: "Plaza Dental - Dr. Christopher J. Smith",
    address: "4821 Plaza Blvd, Chicago, IL 60611",
    phone: "(312) 555-0142",
    website: "https://plazadental.example",
    photoUrl: null,
    rating: 4.6,
    reviewCount: 372,
    lat: 41.8925,
    lng: -87.6244,
    primaryCategory: "Dentist",
  },
  metrics: {
    seoScore: 28,
    missedRevenueYear: 116400,
    trustIndicators: 7,
    trustLabel: "Improvement needed",
    directoriesFound: 1570,
  },
  summary:
    "Plaza Dental has a strong review footprint, but Maps visibility and GBP optimization gaps are leaving significant local demand to competitors. Critical issues include keyword coverage, page speed, and inconsistent NAP signals across the web.",
  factors: [
    { id: "1", title: "Keyword Density", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "2", title: "GMB Optimization", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "3", title: "Backlink Profile", status: "good", statusLabel: "Good", detail: null },
    { id: "4", title: "Mobile Friendly", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "5", title: "Page Speed", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "6", title: "Meta Descriptions", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "7", title: "Schema Markup", status: "manual_check", statusLabel: "Manual check", detail: null },
    { id: "8", title: "Image Alt Tags", status: "manual_check", statusLabel: "Manual check", detail: null },
    { id: "9", title: "Social Presence", status: "good", statusLabel: "Good", detail: null },
    { id: "10", title: "Security (SSL)", status: "good", statusLabel: "Good", detail: null },
    { id: "11", title: "NAP Consistency", status: "needs_attention", statusLabel: "Needs attention", detail: null },
    { id: "12", title: "Local Citations", status: "needs_attention", statusLabel: "Needs attention", detail: null },
  ],
  competitors: [
    { name: "Lakeside Family Dentistry", score: 87, rating: 4.8, reviewCount: 610, address: "Chicago", lat: null, lng: null },
    { name: "North Shore Smiles", score: 82, rating: 4.7, reviewCount: 441, address: "Chicago", lat: null, lng: null },
    { name: "Michigan Ave Dental", score: 79, rating: 4.5, reviewCount: 388, address: "Chicago", lat: null, lng: null },
    { name: "River North Dental Care", score: 74, rating: 4.6, reviewCount: 290, address: "Chicago", lat: null, lng: null },
    { name: "Gold Coast Orthodontics", score: 71, rating: 4.9, reviewCount: 210, address: "Chicago", lat: null, lng: null },
  ],
  reviews: { google: 372, facebook: 48, yelp: 91, rating: 4.6 },
  keywordGrids: [
    {
      keyword: "dentist near me",
      scanId: "preview-scan-1",
      averageRank: 4.8,
      visibilityScore: 62,
      gridSize: 5,
      cells: makeGrid(5, 1),
      status: "ready",
    },
    {
      keyword: "emergency dentist",
      scanId: "preview-scan-2",
      averageRank: 7.2,
      visibilityScore: 48,
      gridSize: 5,
      cells: makeGrid(5, 4),
      status: "ready",
    },
    {
      keyword: "family dentist chicago",
      scanId: "preview-scan-3",
      averageRank: 9.1,
      visibilityScore: 41,
      gridSize: 5,
      cells: makeGrid(5, 7),
      status: "ready",
    },
  ],
  checklist: [
    { id: "seo", label: "SEO Health", done: true },
    { id: "technical", label: "Technical Audit", done: true },
    { id: "gbp", label: "GBP / GMB Profile", done: true },
    { id: "maps", label: "Maps Visibility Grid", done: true },
    { id: "competitors", label: "Competitor Benchmark", done: true },
    { id: "reviews", label: "Reviews Snapshot", done: true },
  ],
  scanInfo: {
    startedAt: "2026-07-20T14:22:00.000Z",
    finishedAt: "2026-07-20T14:41:00.000Z",
    keywords: ["dentist near me", "emergency dentist", "family dentist chicago"],
  },
  org: { name: "Local SEO Express", phone: "(800) 555-0199" },
  growthAuditId: "preview-growth-1",
  latestScanId: "preview-scan-1",
  errorMessage: null,
};
