"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ScanMap } from "@/components/maps/scan-map";

const INCLUDED_ITEMS = [
  "Google Maps visibility",
  "Top competitors",
  "Profile optimization checks",
  "Reviews and review momentum",
  "AI visibility",
  "Local market opportunity",
] as const;

const RUNNING_STEPS = [
  "Checking Google Maps rankings",
  "Identifying local competitors",
  "Auditing business profile signals",
  "Checking AI visibility",
  "Preparing prospect report",
] as const;

type ViewState = "setup" | "running" | "completed";

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

function keywordsFromReport(report: ProspectAuditReport | null): [string, string, string] {
  const kws = report?.scanInfo?.keywords ?? [];
  return [kws[0] ?? "", kws[1] ?? "", kws[2] ?? ""];
}

function resolveViewState(report: ProspectAuditReport): ViewState {
  // Strict: only this prospect-audit row decides the page state.
  // Do not show the finished layout from leftover Growth Audit / old scans.
  if (report.status === "running") return "running";
  if (report.status === "ready" || report.status === "shared") return "completed";
  return "setup"; // idle | draft | failed → review & run
}

function runningStepIndex(report: ProspectAuditReport): number {
  if (report.status === "ready" || report.status === "shared") return RUNNING_STEPS.length;
  let step = 0;
  if (report.keywordGrids.some((g) => g.status === "running" || g.scanId)) step = Math.max(step, 1);
  if (report.keywordGrids.some((g) => g.cells.length > 0)) step = Math.max(step, 2);
  if (report.competitors.length > 0) step = Math.max(step, 3);
  if (report.checklist.some((c) => c.id === "gbp" && c.done)) step = Math.max(step, 4);
  if (report.metrics.seoScore != null) step = Math.max(step, 5);
  return Math.min(Math.max(step, 1), RUNNING_STEPS.length);
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
  const initialKws = keywordsFromReport(initialReport ?? null);
  const [kw1, setKw1] = useState(initialKws[0]);
  const [kw2, setKw2] = useState(initialKws[1]);
  const [kw3, setKw3] = useState(initialKws[2]);
  const [activeKeywordIdx, setActiveKeywordIdx] = useState(0);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Always allow returning to setup to change keywords / re-run
  const [forceSetup, setForceSetup] = useState(false);

  const applyKeywords = useCallback((next: ProspectAuditReport | null) => {
    const [a, b, c] = keywordsFromReport(next);
    if (a || b || c) {
      setKw1(a);
      setKw2(b);
      setKw3(c);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospect-audits?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setReport(json.report);
      applyKeywords(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId, applyKeywords]);

  useEffect(() => {
    if (!initialReport) void load();
    else applyKeywords(initialReport);
  }, [initialReport, load, applyKeywords]);

  useEffect(() => {
    if (report?.status !== "running") return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [report?.status, load]);

  const viewState: ViewState = forceSetup
    ? "setup"
    : report
      ? resolveViewState(report)
      : "setup";
  const grids = report?.keywordGrids ?? [];
  const safeIdx = Math.min(activeKeywordIdx, Math.max(0, grids.length - 1));
  const activeGrid = grids[safeIdx] ?? null;

  async function runAudit() {
    const keywords = [kw1, kw2, kw3].map((k) => k.trim()).filter(Boolean).slice(0, 3);
    if (!keywords.length) {
      setError("Add at least one keyword to run the prospect audit.");
      return;
    }
    setBusy(true);
    setError(null);
    setShareMsg(null);
    setForceSetup(false);
    try {
      // One server call queues Maps grids + Growth Audit + AI Visibility.
      // Jobs keep running after you leave — no browser required.
      const createRes = await fetch("/api/prospect-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, keywords }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Failed to start");

      if (created.report) {
        setReport({ ...created.report, status: "running" });
      } else {
        setReport((prev) =>
          prev
            ? { ...prev, status: "running", scanInfo: { ...prev.scanInfo, keywords } }
            : prev
        );
      }
      if (Array.isArray(created.warnings) && created.warnings.length) {
        setShareMsg(created.warnings.slice(0, 3).join(" · "));
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
  const shortName = b.name.length > 42 ? `${b.name.slice(0, 40)}…` : b.name;

  if (viewState === "setup") {
    const canReturnToReport =
      forceSetup && report && (report.status === "ready" || report.status === "shared");
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className={mock.title}>Prospect Audit</h1>
          <p className={mock.subtitle}>
            Review the business, keywords, and scan settings — then run the audit.
          </p>
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

        <div className={cn(mock.cardPad, "space-y-6")}>
          <section>
            <p className={mock.label}>Business</p>
            <div className="mt-2 flex gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F2F4F7] text-[#667085] ring-1 ring-[#E6EAF0]">
                {b.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#101828]">{b.name}</p>
                <p className="mt-0.5 text-sm text-[#667085]">{b.address ?? "—"}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[#475467]">
                  {b.phone ? <span>{b.phone}</span> : null}
                  {b.website ? (
                    <span className="truncate">{b.website.replace(/^https?:\/\//, "")}</span>
                  ) : null}
                  {b.primaryCategory ? <span>{b.primaryCategory}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className={mock.label}>Keywords to audit</p>
            <p className="mt-1 text-[12px] text-[#667085]">
              Prefills from the prospect. Edit before running — keyword 1 is required.
            </p>
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[#475467]">
                  1. Primary keyword
                </span>
                <input
                  className="w-full rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm outline-none focus:border-[#137752]"
                  value={kw1}
                  onChange={(e) => setKw1(e.target.value)}
                  placeholder="e.g. junk removal Woodbridge"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[#475467]">
                  2. Optional
                </span>
                <input
                  className="w-full rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm outline-none focus:border-[#137752]"
                  value={kw2}
                  onChange={(e) => setKw2(e.target.value)}
                  placeholder="Keyword 2 (optional)"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[#475467]">
                  3. Optional
                </span>
                <input
                  className="w-full rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm outline-none focus:border-[#137752]"
                  value={kw3}
                  onChange={(e) => setKw3(e.target.value)}
                  placeholder="Keyword 3 (optional)"
                />
              </label>
            </div>
          </section>

          <section>
            <p className={mock.label}>Scan settings</p>
            <ul className="mt-2 space-y-1.5 text-sm text-[#475467]">
              <li>
                <span className="font-medium text-[#101828]">Grid size:</span> 7×7
              </li>
              <li>
                <span className="font-medium text-[#101828]">Radius:</span> 5 miles
              </li>
              <li>
                <span className="font-medium text-[#101828]">Scan center:</span>{" "}
                {b.address ?? "business address"}
              </li>
              <li>
                <span className="font-medium text-[#101828]">AI visibility check:</span> included
              </li>
              <li>
                <span className="font-medium text-[#101828]">Google profile audit:</span> included
              </li>
              <li>
                <span className="font-medium text-[#101828]">Competitor analysis:</span> included
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-[#667085]">
              Ready Maps grids for the same keyword and settings are reused — only missing or
              changed keywords start a new scan.
            </p>
          </section>

          <button
            type="button"
            className={cn(mock.btnPrimary, "h-11 w-full justify-center text-[15px]")}
            disabled={busy || !kw1.trim()}
            onClick={() => void runAudit()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run Prospect Audit
          </button>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-[#101828]">What this audit includes</p>
          <ul className="mt-2 space-y-1.5">
            {INCLUDED_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[#475467]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#137752]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canReturnToReport ? (
            <button
              type="button"
              className={mock.btnSecondary}
              onClick={() => setForceSetup(false)}
            >
              Back to report
            </button>
          ) : (
            <Link
              href={`/prospects/${businessId}`}
              className={cn(mock.link, "inline-flex items-center gap-1")}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to prospect
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (viewState === "running") {
    const doneThrough = runningStepIndex(report);
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h1 className={mock.title}>Running Prospect Audit</h1>
          <p className={mock.subtitle}>
            Building the report for &lsquo;{shortName}&rsquo;. You can leave this page — it keeps
            running.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className={cn(mock.cardPad, "space-y-4")}>
          <div className="flex items-center gap-2 text-sm font-medium text-[#137752]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Audit in progress…
          </div>
          <ol className="space-y-3">
            {RUNNING_STEPS.map((label, i) => {
              const stepNum = i + 1;
              const done = stepNum < doneThrough;
              const current = stepNum === doneThrough;
              return (
                <li key={label} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      done
                        ? "bg-[#ECFDF3] text-[#027A48]"
                        : current
                          ? "bg-[#137752] text-white"
                          : "bg-[#F2F4F7] text-[#98A2B3]"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      done || current ? "font-medium text-[#101828]" : "text-[#98A2B3]"
                    )}
                  >
                    {label}
                    {current ? (
                      <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[#137752]" />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-[12px] text-[#667085]">
            Typically 3–5 minutes. Maps grids, profile checks, competitors, and AI visibility all
            keep running on our servers — you can close this tab and come back anytime.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/prospects/${businessId}`} className={mock.btnSecondary}>
            Leave page
          </Link>
          <Link href="/prospects/audits" className={mock.link}>
            All prospect audits
          </Link>
        </div>
      </div>
    );
  }

  // Completed report UI
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
          <button
            type="button"
            className={mock.btnSecondary}
            onClick={() => setForceSetup(true)}
          >
            Configure &amp; Re-run
          </button>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)]">
        <div className="space-y-5">
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

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(mock.card, "flex gap-3 p-4")}>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F2F4F7] text-[#667085] ring-1 ring-[#E6EAF0]">
                {b.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photoUrl}
                    alt={b.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <MapPin className="h-7 w-7" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#101828]">{b.name}</p>
                {b.primaryCategory ? (
                  <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
                    {b.primaryCategory}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[12px] text-[#667085]">{b.address ?? "—"}</p>
                {b.phone ? (
                  <p className="mt-0.5 text-[12px] text-[#475467]">{b.phone}</p>
                ) : null}
                {b.website ? (
                  <a
                    href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block truncate text-[12px] font-medium text-[#137752] hover:underline"
                  >
                    {b.website.replace(/^https?:\/\//, "")}
                  </a>
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

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="border-b border-[#F2F4F7] px-4 py-3">
                <h2 className="text-[14px] font-bold text-[#101828]">Top Competitors</h2>
                <p className="mt-0.5 text-[12px] text-[#667085]">
                  From Maps / DataForSEO listings on this audit
                </p>
              </div>
              {!report.competitors.length ? (
                <p className="px-4 py-6 text-sm text-[#667085]">
                  Competitors appear after a Maps grid finishes.
                </p>
              ) : (
                <ul className="divide-y divide-[#F2F4F7]">
                  {report.competitors.map((c, i) => (
                    <li key={`${c.placeId ?? c.cid ?? c.name}-${i}`} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F2F4F7] ring-1 ring-[#E6EAF0]">
                          {c.mainImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.mainImage}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-[#98A2B3]">
                              {c.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[#101828]">
                                {c.name}
                              </p>
                              {c.category ? (
                                <p className="truncate text-[11px] text-[#667085]">{c.category}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-[15px] font-bold text-[#137752]">
                              {c.score}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#475467]">
                            {c.rating != null ? (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#101828]">
                                <Star className="h-3 w-3 fill-[#FDB022] text-[#FDB022]" />
                                {c.rating.toFixed(1)}
                                {c.reviewCount != null ? (
                                  <span className="font-medium text-[#667085]">
                                    ({c.reviewCount})
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                            {c.avgRank != null ? <span>Avg rank {c.avgRank.toFixed(1)}</span> : null}
                          </div>
                          {c.address ? (
                            <p className="mt-0.5 truncate text-[11px] text-[#667085]">{c.address}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                            {c.website ? (
                              <a
                                href={
                                  c.website.startsWith("http") ? c.website : `https://${c.website}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[#137752] hover:underline"
                              >
                                {(c.domain ?? c.website).replace(/^https?:\/\//, "")}
                              </a>
                            ) : null}
                            {c.phone ? <span className="text-[#475467]">{c.phone}</span> : null}
                            {c.mapsUrl ? (
                              <a
                                href={c.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[#137752] hover:underline"
                              >
                                Maps
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
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
                    cells={[]}
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
                      gridSize: 7,
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
