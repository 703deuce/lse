"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Grid3X3,
  LineChart,
  Link2,
  Loader2,
  MapPinned,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mock } from "@/components/mockup/ui";
import type { ReportType } from "@/lib/reporting/types";
import { ScanExportMenu } from "@/components/reports/scan-export-menu";
import { ReportShareControls } from "@/components/reports/report-share-controls";
import { MonthlyReportWizard } from "@/components/reports/monthly-report-wizard";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  type ReportSectionId,
} from "@/lib/reporting/report-sections";

type ScanOption = {
  id: string;
  keyword: string;
  keywordId: string | null;
  locationId: string | null;
  centerLabel: string | null;
  gridSize: number;
  radiusMeters: number;
  scannedAt: string;
  averageRank: number | null;
  visibilityScore: number | null;
};

type KeywordOption = { id: string; keyword: string; isPrimary: boolean };
type CampaignOption = {
  id: string;
  name: string;
  status: string;
  channel: string;
  sent: number;
  reviewsDetected: number;
};
type MapsCampaignOption = {
  id: string;
  name: string;
  status: string;
  scheduleEnabled: boolean;
  nextRunAt: string | null;
  gridSize: number | null;
  radiusMeters: number | null;
};

type ReportCard = {
  type: ReportType;
  title: string;
  description: string;
  icon: typeof FileText;
  needsScan: boolean;
  needsCampaign?: boolean;
  needsMapsCampaign?: boolean;
  needsKeyword?: boolean;
  available: boolean;
};

type ExportFormat = "share" | "pdf" | "csv";

const REPORT_CARDS: ReportCard[] = [
  {
    type: "single_scan",
    title: "Prospect audit",
    description:
      "Current Maps visibility, competitor presence, and opportunity for outreach.",
    icon: Grid3X3,
    needsScan: true,
    available: true,
  },
  {
    type: "trend",
    title: "Monthly client report",
    description:
      "Ranking change since the prior period, keyword trends, and coverage over time.",
    icon: LineChart,
    needsScan: false,
    available: true,
  },
  {
    type: "maps_campaign",
    title: "Campaign progress report",
    description:
      "Baseline versus current for a keyword group — gains, weak areas, and rollup.",
    icon: Megaphone,
    needsScan: false,
    needsMapsCampaign: true,
    available: true,
  },
  {
    type: "competitor",
    title: "Competitive analysis",
    description: "Local pack share, ratings, and who appears most across the grid.",
    icon: Users,
    needsScan: true,
    available: true,
  },
  {
    type: "location",
    title: "Location/keyword summary",
    description: "All tracked keywords for this location, ranked best to worst.",
    icon: MapPinned,
    needsScan: false,
    available: true,
  },
  {
    type: "keyword",
    title: "Keyword lookup data",
    description: "One keyword across the primary pin and additional rank locations.",
    icon: Target,
    needsScan: false,
    needsKeyword: true,
    available: true,
  },
];

const BUILDER_SECTIONS: ReportSectionId[] = [
  "cover",
  "executive_summary",
  "maps_overview",
  "maps_grid",
  "competitors",
  "review_snapshot",
  "ai_visibility",
  "next_steps",
  "footer",
];

const EXPORT_FORMATS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  {
    id: "share",
    label: "Shareable report",
    hint: "Interactive branded link",
  },
  {
    id: "pdf",
    label: "Standard PDF report",
    hint: "Print-ready download",
  },
  {
    id: "csv",
    label: "CSV (comma separated)",
    hint: "Spreadsheet data export",
  },
];

const PREVIEW_HIGHLIGHTS = [
  { label: "Most visited", icon: Eye },
  { label: "Brand awareness", icon: Sparkles },
  { label: "Best performers", icon: Star },
  { label: "Search rank", icon: TrendingUp },
] as const;

function milesLabel(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

const fieldControl =
  "mt-1.5 h-10 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25";

export function ReportsHub({
  businessId,
  latestScanId,
  initialType,
  initialMapsCampaignId,
  prospectOnly = false,
}: {
  businessId: string;
  latestScanId?: string | null;
  initialType?: ReportType;
  initialMapsCampaignId?: string | null;
  prospectOnly?: boolean;
}) {
  const [scans, setScans] = useState<ScanOption[]>([]);
  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [mapsCampaigns, setMapsCampaigns] = useState<MapsCampaignOption[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [scanId, setScanId] = useState(latestScanId ?? "");
  const [keywordId, setKeywordId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [mapsCampaignId, setMapsCampaignId] = useState(initialMapsCampaignId ?? "");
  const [activeType, setActiveType] = useState<ReportType>(
    prospectOnly ? "single_scan" : initialType ?? "single_scan"
  );
  const [busy, setBusy] = useState<"share" | "csv" | "pdf" | "revoke" | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [shareJobId, setShareJobId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("share");
  const [sections, setSections] = useState<Partial<Record<ReportSectionId, boolean>>>({
    ...DEFAULT_REPORT_SECTIONS,
    ai_visibility: false,
  });
  const requestGen = useRef(0);

  const { status: shareJobStatus, error: sharePollError } = useActiveJobStatus({
    statusUrl: shareJobId ? `/api/jobs/${shareJobId}/status` : null,
    enabled: Boolean(shareJobId),
  });

  useEffect(() => {
    if (sharePollError) {
      setError(sharePollError);
      setBusy(null);
      setShareJobId(null);
      setShareStatus("idle");
    }
  }, [sharePollError]);

  useEffect(() => {
    if (!shareJobId || !shareJobStatus) return;
    if (!isTerminalJobStatus(shareJobStatus.status)) return;
    if (shareJobStatus.status !== "completed") {
      setError(shareJobStatus.errorMessage ?? "Report generation failed");
      setBusy(null);
      setShareJobId(null);
      setShareStatus("idle");
      return;
    }
    const result = (shareJobStatus.result ?? null) as {
      shareUrl?: string | null;
      reportId?: string | null;
    } | null;
    if (result?.shareUrl) setShareUrl(String(result.shareUrl));
    if (result?.reportId) setReportId(String(result.reportId));
    setShareStatus("ready");
    setBusy(null);
    setShareJobId(null);
  }, [shareJobId, shareJobStatus]);

  const loadScans = useCallback(async () => {
    setLoadingScans(true);
    try {
      const res = await fetch(`/api/reports/scans?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load scans");
      const rows = (json.scans ?? []) as ScanOption[];
      setScans(rows);
      if (!scanId && rows[0]?.id) setScanId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scans");
    } finally {
      setLoadingScans(false);
    }
  }, [businessId, scanId]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/reports/options?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load report options");
      const kw = (json.keywords ?? []) as KeywordOption[];
      const camps = (json.campaigns ?? []) as CampaignOption[];
      const mapsCamps = (json.mapsCampaigns ?? []) as MapsCampaignOption[];
      setKeywords(kw);
      setCampaigns(camps);
      setMapsCampaigns(mapsCamps);
      if (!keywordId && kw[0]?.id) setKeywordId(kw[0].id);
      if (!campaignId && camps[0]?.id) setCampaignId(camps[0].id);
      if (!mapsCampaignId && mapsCamps[0]?.id) setMapsCampaignId(mapsCamps[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report options");
    } finally {
      setLoadingOptions(false);
    }
  }, [businessId, campaignId, keywordId, mapsCampaignId]);

  useEffect(() => {
    void loadScans();
    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [businessId]);

  const selectedScan = useMemo(
    () => scans.find((s) => s.id === scanId) ?? null,
    [scans, scanId]
  );

  const resolvedTrendKeywordId = useMemo(() => {
    if (!selectedScan) return null;
    if (selectedScan.keywordId) return selectedScan.keywordId;
    const match = keywords.find(
      (k) => k.keyword.trim().toLowerCase() === selectedScan.keyword.trim().toLowerCase()
    );
    return match?.id ?? null;
  }, [selectedScan, keywords]);

  const reportCards = useMemo(
    () =>
      prospectOnly
        ? REPORT_CARDS.filter((card) => card.type === "single_scan")
        : REPORT_CARDS,
    [prospectOnly]
  );
  const activeCard = reportCards.find((c) => c.type === activeType) ?? reportCards[0];
  const activeIndex = Math.max(0, reportCards.findIndex((c) => c.type === activeType));
  const needsScanPicker = Boolean(
    activeCard.needsScan || activeType === "trend" || activeType === "keyword"
  );

  useEffect(() => {
    requestGen.current += 1;
    setShareUrl(null);
    setReportId(null);
    setShareJobId(null);
    setShareStatus("idle");
  }, [scanId, keywordId, campaignId, mapsCampaignId, activeType]);

  function resetBuilder() {
    setSections({ ...DEFAULT_REPORT_SECTIONS, ai_visibility: false });
    setExportFormat("share");
    setError(null);
    setShareUrl(null);
    setReportId(null);
  }

  const canCreate =
    busy == null &&
    shareStatus !== "generating" &&
    !(activeCard.needsScan && !scanId) &&
    !(activeCard.needsCampaign && !campaignId) &&
    !(activeCard.needsMapsCampaign && !mapsCampaignId) &&
    !(activeCard.needsKeyword && !keywordId);

  async function createReport(format: "share" | "csv") {
    if (!activeCard.available) return;
    if ((activeCard.needsScan || activeType === "trend") && !scanId) {
      setError("Select a completed scan first");
      return;
    }
    if (activeCard.needsCampaign && !campaignId) {
      setError("Select a review campaign first");
      return;
    }
    if (activeCard.needsMapsCampaign && !mapsCampaignId) {
      setError("Select a Maps campaign first");
      return;
    }
    if (activeCard.needsKeyword && !keywordId) {
      setError("Select a keyword first");
      return;
    }
    if (activeType === "trend" && !resolvedTrendKeywordId) {
      setError("This scan has no resolvable keyword. Pick another scan or add the keyword.");
      return;
    }

    const gen = ++requestGen.current;
    setBusy(format);
    setError(null);
    if (format === "share") {
      setShareUrl(null);
      setReportId(null);
    }
    try {
      const body: Record<string, unknown> = {
        businessId,
        reportType: activeType,
        format,
        sections,
      };
      if ((activeType === "single_scan" || activeType === "competitor") && scanId) {
        body.scanBatchId = scanId;
      }
      if (activeType === "keyword" && keywordId) {
        body.keywordId = keywordId;
      } else if (activeType === "trend") {
        body.keywordId = resolvedTrendKeywordId;
      } else if (
        (activeType === "single_scan" || activeType === "competitor") &&
        selectedScan?.keywordId
      ) {
        body.keywordId = selectedScan.keywordId;
      }
      if (activeType === "trend" || activeType === "keyword") {
        if (activeType === "trend") {
          body.locationId = selectedScan ? selectedScan.locationId : null;
        }
        if (selectedScan?.gridSize) body.gridSize = selectedScan.gridSize;
        if (selectedScan?.radiusMeters) body.radiusMeters = selectedScan.radiusMeters;
      }
      if (activeType === "review_campaign" && campaignId) body.campaignId = campaignId;
      if (activeType === "maps_campaign" && mapsCampaignId) {
        body.campaignId = mapsCampaignId;
      }
      if (
        format === "share" &&
        (activeType === "maps_campaign" ||
          activeType === "location" ||
          activeType === "trend" ||
          activeType === "keyword" ||
          activeType === "reviews")
      ) {
        body.force = true;
      }

      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (format === "csv") {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "CSV export failed");
        }
        if (gen !== requestGen.current) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeType}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      if (gen !== requestGen.current) return;

      if (data.shareUrl) setShareUrl(String(data.shareUrl));
      if (data.reportId) setReportId(String(data.reportId));

      if (data.queued && typeof data.jobId === "string") {
        setShareStatus("generating");
        setShareJobId(String(data.jobId));
        return;
      }

      setShareStatus("ready");
      setBusy(null);
    } catch (err) {
      if (gen !== requestGen.current) return;
      setError(err instanceof Error ? err.message : "Export failed");
      setShareStatus("idle");
      setBusy(null);
    } finally {
      if (gen === requestGen.current && format === "csv") setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    try {
      const body: Record<string, unknown> = {
        businessId,
        reportType: activeType,
        format: "pdf",
        force: true,
        sections,
      };
      if ((activeType === "single_scan" || activeType === "competitor") && scanId) {
        body.scanBatchId = scanId;
      }
      if (activeType === "maps_campaign" && mapsCampaignId) {
        body.campaignId = mapsCampaignId;
      }
      if (activeType === "keyword" && keywordId) body.keywordId = keywordId;
      if (activeType === "trend" && resolvedTrendKeywordId) {
        body.keywordId = resolvedTrendKeywordId;
        body.locationId = selectedScan ? selectedScan.locationId : null;
      }

      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "PDF failed");
      const path = data.downloadPath || data.downloadUrl;
      if (!path) throw new Error("No download URL");
      if (String(path).startsWith("http")) {
        window.open(String(path), "_blank", "noopener,noreferrer");
      } else {
        const dl = await fetch(String(path), { credentials: "same-origin" });
        if (!dl.ok) throw new Error("PDF download failed");
        const blob = await dl.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeType}-report.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setBusy(null);
    }
  }

  async function revokeShare() {
    if (!reportId) return;
    setBusy("revoke");
    setError(null);
    try {
      const res = await fetch("/api/reports/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      setShareUrl(null);
      setReportId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  }

  function runPrimaryAction() {
    if (exportFormat === "csv") {
      void createReport("csv");
      return;
    }
    if (exportFormat === "pdf") {
      void downloadPdf();
      return;
    }
    void createReport("share");
  }

  const previewDate = selectedScan?.scannedAt
    ? new Date(selectedScan.scannedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden bg-[#F9FAFB]">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className={mock.title}>
            {prospectOnly ? "Prospect audit report" : "Reports"}
          </h1>
          <p className={mock.subtitle}>
            {prospectOnly
              ? "A focused shareable audit for prospects: Maps visibility, competitor presence, and outreach opportunities."
              : "Easily keep track of all reports and research. Build, customize and share insights that fit your needs."}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="min-w-0 space-y-5">
          <section>
            <h2 className="text-[15px] font-bold tracking-tight text-[#101828]">
              Select a report template
            </h2>
            <div
              className={cn(
                "mt-3 grid gap-3",
                prospectOnly ? "sm:grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {reportCards.map((card, index) => {
                const Icon = card.icon;
                const selected = activeType === card.type;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => {
                      setActiveType(card.type);
                      setShareUrl(null);
                      setReportId(null);
                      setError(null);
                    }}
                    className={cn(
                      "relative flex min-h-[148px] flex-col rounded-xl border p-4 text-left transition",
                      selected
                        ? "border-[#137752] bg-[#ECFDF3]/70 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-[#A6F4C5]"
                        : "border-[#E6EAF0] bg-white hover:border-[#D0D5DD] hover:bg-[#F9FAFB]"
                    )}
                  >
                    {selected ? (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#137752] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        selected
                          ? "bg-white text-[#137752] shadow-sm"
                          : "bg-[#F2F4F7] text-[#475467]"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 pr-6 text-[14px] font-bold text-[#101828]">
                      {index + 1}. {card.title}
                    </p>
                    <p className="mt-1 flex-1 text-[12px] leading-snug text-[#667085]">
                      {card.description}
                    </p>
                    <span className="mt-3 inline-flex h-7 w-7 items-center justify-center self-end rounded-full border border-[#E6EAF0] bg-white text-[#98A2B3]">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {!loadingScans &&
          scans.length === 0 &&
          (activeCard.needsScan ||
            activeType === "trend" ||
            activeType === "location" ||
            activeType === "keyword" ||
            activeType === "maps_campaign") ? (
            <div className={cn(mock.cardPad, "border-[#FEDF89] bg-[#FFFAEB]")}>
              <p className="text-sm font-semibold text-[#B54708]">No completed scans yet</p>
              <p className="mt-1 text-sm text-[#B54708]/80">
                This report needs at least one finished grid scan. Reviews reports can still be
                generated without a scan.
              </p>
            </div>
          ) : null}

          <section className={cn(mock.card, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] px-4 py-3">
              <h3 className="text-[14px] font-bold text-[#101828]">
                Recent preview: {activeCard.title}
              </h3>
              <span className="text-[12px] font-semibold text-[#137752]">View details</span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              <div className="flex min-h-[160px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#137752] to-[#0f6244] p-4 text-white shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
                    Preview
                  </p>
                  <p className="mt-2 text-[16px] font-bold leading-snug">
                    {activeCard.title} Report
                  </p>
                </div>
                <p className="text-[12px] text-white/80">{previewDate}</p>
              </div>
              <div>
                <p className="text-sm leading-relaxed text-[#475467]">
                  {activeCard.description} Select metrics on the right, pick your scan or keyword
                  source, then create a branded share link or download.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PREVIEW_HIGHLIGHTS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="text-center">
                        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="mt-1.5 text-[11px] font-medium text-[#667085]">
                          {item.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {selectedScan ? (
                  <p className="mt-4 text-[12px] text-[#667085]">
                    ARP {selectedScan.averageRank ?? "—"} · Visibility{" "}
                    {selectedScan.visibilityScore ?? "—"}%
                    {selectedScan.centerLabel ? ` · ${selectedScan.centerLabel}` : ""}
                  </p>
                ) : (
                  <p className="mt-4 text-[12px] text-[#98A2B3]">
                    Select a report to start adding customers and data.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {activeType === "trend" ? (
          <div className={cn(mock.card, "h-fit overflow-hidden p-4 xl:sticky xl:top-4")}>
            <MonthlyReportWizard
              businessId={businessId}
              scans={scans}
              keywords={keywords}
            />
          </div>
        ) : (
          <aside className={cn(mock.card, "h-fit overflow-hidden xl:sticky xl:top-4")}>
            <div className="flex items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
              <h2 className="text-[15px] font-bold text-[#101828]">Build your report</h2>
              <button
                type="button"
                onClick={resetBuilder}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#137752] hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <p className={mock.label}>Select metrics</p>
                <div className="mt-2 space-y-1">
                  {BUILDER_SECTIONS.map((id) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#344054] hover:bg-[#F9FAFB]"
                    >
                      <span>{REPORT_SECTION_LABELS[id]}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D0D5DD] text-[#137752] focus:ring-[#137752]"
                        checked={sections[id] !== false}
                        onChange={(e) =>
                          setSections((prev) => ({ ...prev, [id]: e.target.checked }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              {needsScanPicker ? (
                <div>
                  <label className={mock.label}>
                    {activeType === "keyword" ? "Grid settings (from scan)" : "Page / scan"}
                  </label>
                  {loadingScans ? (
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-[#667085]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading scans…
                    </p>
                  ) : scans.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[#B54708]">
                      No completed scans yet
                      {activeType === "keyword" ? " — using default 7×7 / 5 mi." : "."}
                    </p>
                  ) : (
                    <div className="relative mt-1.5">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                      <select
                        className={cn(fieldControl, "mt-0 appearance-none pl-9 pr-8")}
                        value={scanId}
                        onChange={(e) => setScanId(e.target.value)}
                      >
                        {scans.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.keyword} · {s.gridSize}×{s.gridSize} · {milesLabel(s.radiusMeters)}{" "}
                            · {new Date(s.scannedAt).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    </div>
                  )}
                  {selectedScan ? (
                    <p className="mt-1.5 text-[11px] text-[#667085]">
                      ARP {selectedScan.averageRank ?? "—"} · Visibility{" "}
                      {selectedScan.visibilityScore ?? "—"}%
                      {selectedScan.centerLabel ? ` · ${selectedScan.centerLabel}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activeCard.needsKeyword ? (
                <div>
                  <label className={mock.label}>Keyword</label>
                  {loadingOptions ? (
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-[#667085]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading keywords…
                    </p>
                  ) : keywords.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[#B54708]">Add a keyword first.</p>
                  ) : (
                    <select
                      className={fieldControl}
                      value={keywordId}
                      onChange={(e) => setKeywordId(e.target.value)}
                    >
                      {keywords.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.keyword}
                          {k.isPrimary ? " (primary)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}

              {activeCard.needsCampaign ? (
                <div>
                  <label className={mock.label}>Review campaign</label>
                  {loadingOptions ? (
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-[#667085]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading campaigns…
                    </p>
                  ) : campaigns.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[#B54708]">
                      No review campaigns yet. Create one under Review Campaigns first.
                    </p>
                  ) : (
                    <select
                      className={fieldControl}
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                    >
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.status} · {c.sent} sent · {c.reviewsDetected} attributed
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}

              {activeCard.needsMapsCampaign ? (
                <div>
                  <label className={mock.label}>Maps campaign</label>
                  {loadingOptions ? (
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-[#667085]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading campaigns…
                    </p>
                  ) : mapsCampaigns.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[#B54708]">
                      No Maps campaigns yet. Create one under Campaigns first.
                    </p>
                  ) : (
                    <select
                      className={fieldControl}
                      value={mapsCampaignId}
                      onChange={(e) => setMapsCampaignId(e.target.value)}
                    >
                      {mapsCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.scheduleEnabled ? " · scheduled" : " · manual"}
                          {c.gridSize ? ` · ${c.gridSize}×${c.gridSize}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}

              <div>
                <p className={mock.label}>Download options</p>
                <div className="mt-2 space-y-1.5">
                  {EXPORT_FORMATS.map((fmt) => (
                    <label
                      key={fmt.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition",
                        exportFormat === fmt.id
                          ? "border-[#A6F4C5] bg-[#ECFDF3]/60"
                          : "border-[#E6EAF0] bg-white hover:bg-[#F9FAFB]"
                      )}
                    >
                      <input
                        type="radio"
                        name="export-format"
                        className="mt-0.5 text-[#137752] focus:ring-[#137752]"
                        checked={exportFormat === fmt.id}
                        onChange={() => setExportFormat(fmt.id)}
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-[#101828]">
                          {fmt.label}
                        </span>
                        <span className="block text-[11px] text-[#667085]">{fmt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {activeType === "single_scan" && scanId ? (
                <ScanExportMenu
                  businessId={businessId}
                  scanBatchId={scanId}
                  layout="stack"
                  className="border-t border-[#F2F4F7] pt-3"
                />
              ) : null}

              <button
                type="button"
                disabled={!canCreate}
                onClick={runPrimaryAction}
                className={cn(mock.btnPrimary, "h-11 w-full")}
              >
                {busy != null || shareStatus === "generating" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {shareStatus === "generating"
                  ? "Creating report…"
                  : exportFormat === "pdf"
                    ? "Create PDF report"
                    : exportFormat === "csv"
                      ? "Download CSV"
                      : "Create custom report"}
              </button>

              {shareStatus === "generating" ? (
                <p className="text-[11px] text-[#667085]">
                  Queued on the report worker. This page stays usable — the share link appears when
                  ready.
                </p>
              ) : null}

              <button
                type="button"
                disabled={!canCreate}
                onClick={() => void createReport("csv")}
                className="w-full text-center text-[13px] font-semibold text-[#137752] hover:underline disabled:opacity-50"
              >
                Download CSV
              </button>

              {shareUrl ? (
                <div className="space-y-2 border-t border-[#F2F4F7] pt-3">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(mock.btnSecondary, "h-9 w-full")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Open report (Print → PDF)
                  </a>
                  {reportId ? (
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void revokeShare()}
                      className={cn(mock.btnSecondary, "h-9 w-full")}
                    >
                      {busy === "revoke" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )}
                      Revoke share link
                    </button>
                  ) : null}
                  <p className="break-all text-[11px] text-[#667085]">{shareUrl}</p>
                  {reportId ? (
                    <ReportShareControls
                      businessId={businessId}
                      reportId={reportId}
                      shareUrl={shareUrl}
                      onShareUrlChange={setShareUrl}
                      keyword={selectedScan?.keyword}
                      reportLabel={activeCard.title}
                      kpis={{
                        arp: selectedScan?.averageRank ?? null,
                        visibilityScore: selectedScan?.visibilityScore ?? null,
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-[12px] text-[#B42318]">{error}</p> : null}

              <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#137752] shadow-sm">
                    <Link2 className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-[#027A48]">Support</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[#027A48]/90">
                      {prospectOnly
                        ? "Share link = focused prospect audit with your report branding."
                        : `Template ${activeIndex + 1}: ${activeCard.title}. Branding is under Settings → Report branding.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
