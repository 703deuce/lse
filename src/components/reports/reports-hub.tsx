"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Download,
  FileText,
  Grid3X3,
  LineChart,
  Link2,
  Loader2,
  MapPinned,
  Megaphone,
  Target,
  Users,
} from "lucide-react";
import {
  ContentCard,
  EmptyState,
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
  inputClass,
  fieldLabelClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReportType } from "@/lib/reporting/types";
import { ScanExportMenu } from "@/components/reports/scan-export-menu";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";

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

type ReportCard = {
  type: ReportType;
  title: string;
  description: string;
  icon: typeof FileText;
  needsScan: boolean;
  needsCampaign?: boolean;
  needsKeyword?: boolean;
  available: boolean;
};

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
    available: true,
  },
  {
    type: "competitor",
    title: "Competitor visibility",
    description: "Local pack share, ratings, and who appears most across the grid.",
    icon: Users,
    needsScan: true,
    available: true,
  },
  {
    type: "location",
    title: "Location keyword summary",
    description: "All tracked keywords for this location, ranked best to worst.",
    icon: MapPinned,
    needsScan: false,
    available: true,
  },
  {
    type: "keyword",
    title: "Keyword deep dive",
    description: "One keyword across the primary pin and additional rank locations.",
    icon: Target,
    needsScan: false,
    needsKeyword: true,
    available: true,
  },
];

function milesLabel(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function ReportsHub({
  businessId,
  latestScanId,
}: {
  businessId: string;
  latestScanId?: string | null;
}) {
  const [scans, setScans] = useState<ScanOption[]>([]);
  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [scanId, setScanId] = useState(latestScanId ?? "");
  const [keywordId, setKeywordId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [activeType, setActiveType] = useState<ReportType>("single_scan");
  const [busy, setBusy] = useState<"share" | "csv" | "revoke" | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [shareJobId, setShareJobId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
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
      setKeywords(kw);
      setCampaigns(camps);
      if (!keywordId && kw[0]?.id) setKeywordId(kw[0].id);
      if (!campaignId && camps[0]?.id) setCampaignId(camps[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report options");
    } finally {
      setLoadingOptions(false);
    }
  }, [businessId, campaignId, keywordId]);

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

  const activeCard = REPORT_CARDS.find((c) => c.type === activeType) ?? REPORT_CARDS[0];
  const needsScanPicker = Boolean(
    activeCard.needsScan || activeType === "trend" || activeType === "keyword"
  );

  // Drop stale share links when report inputs change (identity moves).
  useEffect(() => {
    requestGen.current += 1;
    setShareUrl(null);
    setReportId(null);
    setShareJobId(null);
    setShareStatus("idle");
  }, [scanId, keywordId, campaignId, activeType]);

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
      };
      // Only attach scanBatchId for reports that are about a specific scan.
      if (
        (activeType === "single_scan" || activeType === "competitor") &&
        scanId
      ) {
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
        // Always pass locationId for trend (including null = business location).
        if (activeType === "trend") {
          body.locationId = selectedScan ? selectedScan.locationId : null;
        }
        if (selectedScan?.gridSize) body.gridSize = selectedScan.gridSize;
        if (selectedScan?.radiusMeters) body.radiusMeters = selectedScan.radiusMeters;
      }
      if (activeType === "review_campaign" && campaignId) body.campaignId = campaignId;

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

      // Queued: keep "Creating report…" while the report worker fills HTML.
      if (data.queued && typeof data.jobId === "string") {
        setShareStatus("generating");
        setShareJobId(String(data.jobId));
        // busy cleared when poll settles
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

  return (
    <ModulePage wide>
      <ModuleHeader
        title="Reports"
        subtitle="Client-ready Maps and Reviews reports — PDF, map images, share links, and CSV."
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_CARDS.map((card) => {
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
                    "rounded-xl border p-3.5 text-left transition",
                    selected
                      ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        selected ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900">{card.title}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {!loadingScans &&
          scans.length === 0 &&
          (activeCard.needsScan ||
            activeType === "trend" ||
            activeType === "location" ||
            activeType === "keyword" ||
            activeType === "maps_campaign") ? (
            <EmptyState
              title="No completed scans yet"
              description="This report needs at least one finished grid scan. Reviews and Review Campaign reports can still be generated without a scan."
            />
          ) : null}
        </div>

        <ContentCard className="h-fit xl:sticky xl:top-4">
          <h2 className="text-[13px] font-semibold text-zinc-900">{activeCard.title}</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{activeCard.description}</p>

          {needsScanPicker && (
            <div className="mt-3">
              <label className={fieldLabelClass}>
                {activeType === "trend"
                  ? "Anchor scan (keyword / grid)"
                  : activeType === "keyword"
                    ? "Grid settings (from scan)"
                    : "Scan"}
              </label>
              {loadingScans ? (
                <p className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading scans…
                </p>
              ) : scans.length === 0 ? (
                <p className="mt-1 text-[12px] text-amber-700">
                  No completed scans yet
                  {activeType === "keyword" ? " — using default 7×7 / 5 mi." : "."}
                </p>
              ) : (
                <select
                  className={cn(inputClass, "mt-1")}
                  value={scanId}
                  onChange={(e) => setScanId(e.target.value)}
                >
                  {scans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.keyword} · {s.gridSize}×{s.gridSize} · {milesLabel(s.radiusMeters)} ·{" "}
                      {new Date(s.scannedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
              {selectedScan ? (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  ARP {selectedScan.averageRank ?? "—"} · Visibility{" "}
                  {selectedScan.visibilityScore ?? "—"}%
                  {selectedScan.centerLabel ? ` · ${selectedScan.centerLabel}` : ""}
                </p>
              ) : null}
            </div>
          )}

          {activeCard.needsKeyword ? (
            <div className="mt-3">
              <label className={fieldLabelClass}>Keyword</label>
              {loadingOptions ? (
                <p className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading keywords…
                </p>
              ) : keywords.length === 0 ? (
                <p className="mt-1 text-[12px] text-amber-700">Add a keyword first.</p>
              ) : (
                <select
                  className={cn(inputClass, "mt-1")}
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
            <div className="mt-3">
              <label className={fieldLabelClass}>Review campaign</label>
              {loadingOptions ? (
                <p className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading campaigns…
                </p>
              ) : campaigns.length === 0 ? (
                <p className="mt-1 text-[12px] text-amber-700">
                  No review campaigns yet. Create one under Review Campaigns first.
                </p>
              ) : (
                <select
                  className={cn(inputClass, "mt-1")}
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

          <div className="mt-4 flex flex-col gap-2">
            {activeType === "single_scan" && scanId ? (
              <ScanExportMenu businessId={businessId} scanBatchId={scanId} className="mb-2" />
            ) : null}
            <button
              type="button"
              disabled={
                busy != null ||
                shareStatus === "generating" ||
                ((activeCard.needsScan || activeType === "trend") && !scanId) ||
                (activeType === "trend" && !resolvedTrendKeywordId) ||
                (activeCard.needsCampaign && !campaignId) ||
                (activeCard.needsKeyword && !keywordId)
              }
              onClick={() => void createReport("share")}
              className={cn(btnPrimary, "h-9 w-full justify-center px-3 text-[13px]")}
            >
              {busy === "share" || shareStatus === "generating" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {shareStatus === "generating" ? "Creating report…" : "Create shareable report"}
            </button>
            {shareStatus === "generating" ? (
              <p className="text-[11px] text-zinc-500">
                Queued on the report worker. This page stays usable — the share link appears when ready.
              </p>
            ) : null}
            <button
              type="button"
              disabled={
                busy != null ||
                ((activeCard.needsScan || activeType === "trend") && !scanId) ||
                (activeType === "trend" && !resolvedTrendKeywordId) ||
                (activeCard.needsCampaign && !campaignId) ||
                (activeCard.needsKeyword && !keywordId)
              }
              onClick={() => void createReport("csv")}
              className={cn(btnSecondary, "h-9 w-full justify-center px-3 text-[13px]")}
            >
              {busy === "csv" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download CSV
            </button>
            {shareUrl ? (
              <>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(btnSecondary, "h-9 w-full justify-center px-3 text-[13px]")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open report (Print → PDF)
                </a>
                {reportId ? (
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void revokeShare()}
                    className={cn(btnSecondary, "h-9 w-full justify-center px-3 text-[13px]")}
                  >
                    {busy === "revoke" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Ban className="h-3.5 w-3.5" />
                    )}
                    Revoke share link
                  </button>
                ) : null}
                <p className="break-all text-[11px] text-zinc-500">{shareUrl}</p>
              </>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}

          <div className="mt-4 border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-700">Exports</p>
            <p className="mt-1">
              Share link = interactive report. Use the in-report <strong>Print / Save as PDF</strong>{" "}
              button for client PDFs. CSV is for spreadsheet analysis. Branding (logo/colors) is under
              Settings → Report branding.
            </p>
          </div>
        </ContentCard>
      </div>
    </ModulePage>
  );
}
