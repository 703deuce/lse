import type { HeatmapCell } from "@/lib/reporting/types";

export type ProspectAuditStatus =
  | "draft"
  | "running"
  | "ready"
  | "failed"
  | "shared"
  | "idle";

export type AuditFactorStatus = "good" | "needs_attention" | "manual_check" | "unknown";

export type ProspectAuditFactor = {
  id: string;
  title: string;
  status: AuditFactorStatus;
  statusLabel: string;
  detail: string | null;
};

export type ProspectAuditCompetitor = {
  name: string;
  score: number;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type ProspectAuditKeywordGrid = {
  keyword: string;
  scanId: string | null;
  averageRank: number | null;
  visibilityScore: number | null;
  gridSize: number;
  cells: HeatmapCell[];
  status: "ready" | "running" | "missing";
};

export type ProspectAuditReport = {
  auditId: string | null;
  status: ProspectAuditStatus;
  business: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    photoUrl: string | null;
    rating: number | null;
    reviewCount: number | null;
    lat: number | null;
    lng: number | null;
    primaryCategory: string | null;
  };
  metrics: {
    seoScore: number | null;
    missedRevenueYear: number | null;
    trustIndicators: number | null;
    trustLabel: string;
    directoriesFound: number | null;
  };
  summary: string;
  factors: ProspectAuditFactor[];
  competitors: ProspectAuditCompetitor[];
  reviews: {
    google: number | null;
    facebook: number | null;
    yelp: number | null;
    rating: number | null;
  };
  keywordGrids: ProspectAuditKeywordGrid[];
  checklist: Array<{ id: string; label: string; done: boolean }>;
  scanInfo: {
    startedAt: string | null;
    finishedAt: string | null;
    keywords: string[];
  };
  org: {
    name: string | null;
    phone: string | null;
  };
  growthAuditId: string | null;
  latestScanId: string | null;
  errorMessage: string | null;
};
