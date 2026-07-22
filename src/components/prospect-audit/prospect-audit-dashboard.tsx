"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Info,
  Link2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  Star,
} from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";
import type {
  ProspectAuditFactor,
  ProspectAuditKeywordGrid,
  ProspectAuditReport,
} from "@/lib/prospect-audit/types";
import { ScanMap, type GridCell } from "@/components/maps/scan-map";

function ScoreRing({ score }: { score: number | null }) {
  const value = score ?? 0;
  const color =
    value >= 70 ? "#137752" : value >= 45 ? "#F79009" : "#F04438";
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#F2F4F7" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold text-[#101828]">
          {score != null ? `${Math.round(score)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

function FactorIcon({ status }: { status: ProspectAuditFactor["status"] }) {
  if (status === "good") {
    return <CheckCircle2 className="h-4 w-4 text-[#027A48]" />;
  }
  if (status === "needs_attention") {
    return <AlertTriangle className="h-4 w-4 text-[#B42318]" />;
  }
  return <Info className="h-4 w-4 text-[#B54708]" />;
}

function factorBadge(status: ProspectAuditFactor["status"]) {
  if (status === "good") return mock.badgeGreen;
  if (status === "needs_attention") return mock.badgeRed;
  if (status === "manual_check") return mock.badgeAmber;
  return "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]";
}

function HeatmapGrid({ grid }: { grid: ProspectAuditKeywordGrid }) {
  if (!grid.cells.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E6EAF0] bg-[#F9FAFB] text-sm text-[#667085]">
        {grid.status === "running"
          ? "Grid scan running…"
          : "No Maps grid for this keyword yet"}
      </div>
    );
  }
  return (
    <div
      className="mx-auto grid max-w-[280px] gap-1.5"
      style={{ gridTemplateColumns: `repeat(${grid.gridSize}, minmax(0, 1fr))` }}
    >
      {grid.cells.map((cell) => (
        <div
          key={`${cell.row}-${cell.col}`}
          className="flex aspect-square items-center justify-center rounded-full text-[10px] font-bold shadow-sm"
          style={{ backgroundColor: cell.color, color: cell.textColor }}
          title={`${cell.label}: ${cell.rank ?? "20+"}`}
        >
          {cell.rank ?? "20+"}
        </div>
      ))}
    </div>
  );
}

function money(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} / yr`;
}

export function ProspectAuditDashboard({
  businessId,
  initialReport,
}: {
  businessId: string;
  initialReport?: ProspectAuditReport | null;
}) {
  const [report, setReport] = useState<ProspectAuditReport | null>(
    initialReport ?? null
  );
  const [loading, setLoading] = useState(!initialReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordText, setKeywordText] = useState("");
  const [activeKeywordIdx, setActiveKeywordIdx] = useState(0);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospect-audits?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setReport(json.report);
      if (json.report?.scanInfo?.keywords?.length) {
        setKeywordText(json.report.scanInfo.keywords.join("\n"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!initialReport) void load();
  }, [initialReport, load]);

  // Poll while running
  useEffect(() => {
    if (report?.status !== "running") return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [report?.status, load]);

  const grids = report?.keywordGrids ?? [];
  const safeIdx = Math.min(activeKeywordIdx, Math.max(0, grids.length - 1));
  const activeGrid = grids[safeIdx] ?? null;

  const mapCells: GridCell[] = useMemo(() => {
    if (!activeGrid?.cells.length || report?.business.lat == null) return [];
    // Heatmap cells lack lat/lng — map overview uses competitor pins only via center.
    return [];
  }, [activeGrid, report?.business.lat]);

  async function runAudit() {
    const keywords = keywordText
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!keywords.length) {
      setError("Add 1–3 keywords to run the prospect audit.");
      return;
    }
    setBusy(true);
    setError(null);
    setShareMsg(null);
    try {
      const createRes = await fetch("/api/prospect-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, keywords }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Failed to start");

      const scanIds: string[] = [];
      for (const keyword of keywords) {
        const scanRes = await fetch("/api/scans/run-for-keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, keyword }),
        });
        const scanJson = await scanRes.json().catch(() => ({}));
        if (scanRes.ok && scanJson.scan?.id) scanIds.push(String(scanJson.scan.id));
      }

      await fetch("/api/growth-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, keyword: keywords[0] }),
      }).catch(() => null);

      if (created.auditId && !String(created.auditId).startsWith("ephemeral-")) {
        await fetch(`/api/prospect-audits/${created.auditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanBatchIds: scanIds,
            status: "running",
          }),
        });
      }

      setActiveKeywordIdx(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run audit");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (!report?.latestScanId) {
      setShareMsg("Run a Maps grid first to share a prospect report.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          type: "single_scan",
          format: "share",
          scanId: report.latestScanId,
          scope: "prospect",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Share failed");
      if (report.auditId) {
        await fetch(`/api/prospect-audits/${report.auditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markShared: true }),
        });
      }
      const url = json.shareUrl || json.url || json.link;
      if (url && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(String(url));
        setShareMsg("Share link copied to clipboard.");
      } else {
        setShareMsg(url ? String(url) : "Share queued — open Reports to copy the link.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    if (!report?.latestScanId) {
      setShareMsg("Run a Maps grid first to export a PDF.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          type: "single_scan",
          format: "pdf",
          scanId: report.latestScanId,
          scope: "prospect",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      setShareMsg(
        json.downloadUrl
          ? "PDF export ready — check Reports artifacts."
          : "PDF export queued."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !report) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#667085]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading prospect audit…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Unable to load prospect audit"}
      </div>
    );
  }

  const b = report.business;
  const shortName =
    b.name.length > 42 ? `${b.name.slice(0, 40)}…` : b.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={mock.title}>Prospect Audit</h1>
            <Info className="h-4 w-4 text-[#98A2B3]" />
          </div>
          <p className={mock.subtitle}>
            A comprehensive SEO audit for &lsquo;{shortName}&rsquo; highlighting key areas for
            improvement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={mock.btnSecondary} onClick={() => void exportPdf()} disabled={busy}>
            <FileDown className="h-4 w-4" />
            Export
          </button>
          <button type="button" className={mock.btnSecondary} onClick={() => void shareLink()} disabled={busy}>
            <Link2 className="h-4 w-4" />
            Share Link
          </button>
          <button type="button" className={mock.btnSecondary} onClick={() => void runAudit()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-run Audit
          </button>
          <button type="button" className={mock.btnPrimary} onClick={() => void exportPdf()} disabled={busy}>
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {shareMsg ? (
        <div className="rounded-lg border border-[#A6F4C5] bg-[#ECFDF3] px-3 py-2 text-sm text-[#027A48]">
          {shareMsg}
        </div>
      ) : null}

      {/* Run controls when idle / no score */}
      {(report.status === "idle" || report.metrics.seoScore == null) && (
        <div className={cn(mock.cardPad, "space-y-3")}>
          <h2 className="text-[15px] font-bold text-[#101828]">Run prospect audit</h2>
          <p className="text-sm text-[#667085]">
            Enter up to 3 keywords. We&apos;ll score SEO health, pull competitor gaps, and build a
            Maps geo-grid per keyword for your sales conversation.
          </p>
          <textarea
            className="min-h-[88px] w-full rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm outline-none focus:border-[#137752]"
            placeholder={"dentist near me\nemergency dentist\nfamily dentist chicago"}
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
          />
          <button type="button" className={mock.btnPrimary} disabled={busy} onClick={() => void runAudit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start audit
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)]">
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(mock.card, "flex items-center gap-3 p-4")}>
              <ScoreRing score={report.metrics.seoScore} />
              <div>
                <p className={mock.label}>SEO Optimization Score</p>
                <p className="mt-1 text-sm text-[#667085]">Overall local SEO health</p>
              </div>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Missed Revenue Opportunities</p>
              <p className="text-[26px] font-bold tracking-tight text-[#027A48]">
                {money(report.metrics.missedRevenueYear)}
              </p>
              <p className="text-xs text-[#667085]">Estimated annual impact of gaps</p>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Trust Indicators</p>
              <p className="text-[26px] font-bold tracking-tight text-[#101828]">
                {report.metrics.trustIndicators != null
                  ? String(report.metrics.trustIndicators).padStart(2, "0")
                  : "—"}
              </p>
              <p className="text-xs font-medium text-[#B54708]">{report.metrics.trustLabel}</p>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Visibility</p>
              <p className="text-[18px] font-bold leading-snug text-[#5925DC]">
                {report.metrics.directoriesFound != null
                  ? `Found on ${report.metrics.directoriesFound.toLocaleString()} directories`
                  : "Run audit to estimate"}
              </p>
            </div>
          </div>

          {/* Profile + summary */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(mock.card, "flex gap-3 p-4")}>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F2F4F7] text-[#667085]">
                {b.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <MapPin className="h-7 w-7" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#101828]">{b.name}</p>
                <p className="mt-0.5 text-[12px] text-[#667085]">{b.address ?? "—"}</p>
                {b.phone ? (
                  <p className="mt-0.5 text-[12px] text-[#475467]">{b.phone}</p>
                ) : null}
                <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#101828]">
                  <Star className="h-3.5 w-3.5 fill-[#FDB022] text-[#FDB022]" />
                  {b.rating != null ? b.rating.toFixed(1) : "—"}
                  <span className="font-medium text-[#667085]">
                    ({b.reviewCount ?? 0} reviews)
                  </span>
                </p>
              </div>
            </div>
            <div className={cn(mock.cardPad)}>
              <p className="text-[14px] font-bold text-[#101828]">Audit Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-[#475467]">{report.summary}</p>
            </div>
          </div>

          {/* Factor grid */}
          <div>
            <h2 className="mb-3 text-[15px] font-bold text-[#101828]">Audit details</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {report.factors.map((f) => (
                <div key={f.id} className={cn(mock.card, "flex items-start gap-2.5 p-3.5")}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F9FAFB]">
                    <FactorIcon status={f.status} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#101828]">{f.title}</p>
                    <span className={cn(factorBadge(f.status), "mt-1")}>{f.statusLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Competitors + map */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="border-b border-[#F2F4F7] px-4 py-3">
                <h2 className="text-[14px] font-bold text-[#101828]">Top Competitors</h2>
              </div>
              {!report.competitors.length ? (
                <p className="px-4 py-6 text-sm text-[#667085]">
                  Competitors appear after a Maps grid finishes.
                </p>
              ) : (
                <ul className="divide-y divide-[#F2F4F7]">
                  {report.competitors.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#101828]">
                          {c.name}
                        </p>
                        {c.reviewCount != null ? (
                          <p className="text-[11px] text-[#667085]">
                            {c.rating?.toFixed(1) ?? "—"} · {c.reviewCount} reviews
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[15px] font-bold text-[#137752]">{c.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="border-b border-[#F2F4F7] px-4 py-3">
                <h2 className="text-[14px] font-bold text-[#101828]">Local Map Overview</h2>
              </div>
              <div className="p-2">
                {b.lat != null && b.lng != null ? (
                  <ScanMap
                    officeCenter={[b.lat, b.lng]}
                    cells={mapCells}
                    businessName={b.name}
                    height="220px"
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center rounded-lg bg-[#F2F4F7] text-sm text-[#667085]">
                    Set a scan center on this prospect to show the map.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reviews + geo grid */}
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
            <div className={cn(mock.cardPad, "space-y-3")}>
              <h2 className="text-[14px] font-bold text-[#101828]">Reviews</h2>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="text-[#667085]">Google</span>
                  <span className="font-semibold text-[#101828]">
                    {report.reviews.google ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#667085]">Facebook</span>
                  <span className="font-semibold text-[#101828]">
                    {report.reviews.facebook ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#667085]">Yelp</span>
                  <span className="font-semibold text-[#101828]">
                    {report.reviews.yelp ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
                <div>
                  <h2 className="text-[14px] font-bold text-[#101828]">Ranking Geo-Grid</h2>
                  <p className="text-[12px] text-[#667085]">
                    Switch keywords without stacking maps
                  </p>
                </div>
                {grids.length > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1 hover:bg-[#F2F4F7] disabled:opacity-40"
                      disabled={safeIdx <= 0}
                      onClick={() => setActiveKeywordIdx((i) => Math.max(0, i - 1))}
                      aria-label="Previous keyword"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex gap-1">
                      {grids.map((g, i) => (
                        <button
                          key={g.keyword + i}
                          type="button"
                          onClick={() => setActiveKeywordIdx(i)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            i === safeIdx
                              ? "bg-[#137752] text-white"
                              : "bg-[#F2F4F7] text-[#475467]"
                          )}
                        >
                          {g.keyword.length > 18 ? `${g.keyword.slice(0, 16)}…` : g.keyword}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1 hover:bg-[#F2F4F7] disabled:opacity-40"
                      disabled={safeIdx >= grids.length - 1}
                      onClick={() =>
                        setActiveKeywordIdx((i) => Math.min(grids.length - 1, i + 1))
                      }
                      aria-label="Next keyword"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_9rem]">
                <HeatmapGrid
                  grid={
                    activeGrid ?? {
                      keyword: "—",
                      scanId: null,
                      averageRank: null,
                      visibilityScore: null,
                      gridSize: 5,
                      cells: [],
                      status: "missing",
                    }
                  }
                />
                <div className="space-y-2 text-[12px]">
                  <p className="font-semibold text-[#101828]">Rank Status</p>
                  <p className="text-[#667085]">
                    Average Rank:{" "}
                    <span className="font-semibold text-[#101828]">
                      {activeGrid?.averageRank != null
                        ? activeGrid.averageRank.toFixed(1)
                        : "—"}
                    </span>
                  </p>
                  <p className="text-[#667085]">
                    Keyword:{" "}
                    <span className="font-semibold text-[#101828]">
                      {activeGrid?.keyword ?? "—"}
                    </span>
                  </p>
                  {activeGrid?.scanId ? (
                    <Link
                      href={`/businesses/${businessId}/grid/${activeGrid.scanId}`}
                      className={mock.link}
                    >
                      Open full grid
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          <div className={cn(mock.cardPad, "space-y-3")}>
            <h2 className="text-[14px] font-bold text-[#101828]">Audit Details</h2>
            <ul className="space-y-2">
              {report.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-[13px]">
                  <CheckCircle2
                    className={cn(
                      "h-4 w-4",
                      item.done ? "text-[#137752]" : "text-[#D0D5DD]"
                    )}
                  />
                  <span className={item.done ? "text-[#101828]" : "text-[#98A2B3]"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(mock.cardPad, "space-y-2 text-[13px]")}>
            <h2 className="text-[14px] font-bold text-[#101828]">Quick Scan Info</h2>
            <p className="text-[#667085]">
              Status:{" "}
              <span className="font-semibold capitalize text-[#101828]">{report.status}</span>
            </p>
            <p className="text-[#667085]">
              Started:{" "}
              {report.scanInfo.startedAt
                ? new Date(report.scanInfo.startedAt).toLocaleString()
                : "—"}
            </p>
            <p className="text-[#667085]">
              Keywords: {report.scanInfo.keywords.join(", ") || "—"}
            </p>
            <Link href={`/businesses/${businessId}/growth-audit`} className={mock.link}>
              Open full Growth Audit
            </Link>
          </div>

          <div className={cn(mock.cardPad, "space-y-3")}>
            <h2 className="text-[14px] font-bold text-[#101828]">Share Report</h2>
            <div className="flex gap-2">
              <button type="button" className={mock.btnSecondary} onClick={() => void shareLink()}>
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button type="button" className={mock.btnSecondary} onClick={() => void exportPdf()}>
                <Download className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#137752] p-4 text-white shadow-sm">
            <p className="text-[15px] font-bold">Boost Your SEO Now</p>
            <p className="mt-1 text-[12px] text-white/85">
              Turn these gaps into a signed client with a clear next step.
            </p>
            <Link
              href={`/prospects/${businessId}`}
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-white text-sm font-semibold text-[#137752]"
            >
              Get Started
            </Link>
            {report.org.phone ? (
              <p className="mt-2 flex items-center justify-center gap-1 text-[12px] text-white/90">
                <Phone className="h-3.5 w-3.5" />
                {report.org.phone}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
