"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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
  XCircle,
} from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";
import type {
  ProspectAuditFactor,
  ProspectAuditKeywordGrid,
  ProspectAuditReport,
} from "@/lib/prospect-audit/types";
import { ScanMap, type GridCell } from "@/components/maps/scan-map";
import { DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import { updateBusinessSettings } from "@/lib/actions/mutations";

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
    return <CheckCircle2 className="h-5 w-5 text-[#027A48]" />;
  }
  if (status === "needs_attention") {
    return <XCircle className="h-5 w-5 text-[#D92D20]" />;
  }
  return <Info className="h-5 w-5 text-[#B54708]" />;
}

function moneyMonth(yearTotal: number | null): string {
  if (yearTotal == null) return "—";
  const monthly = Math.round(yearTotal / 12);
  return `$${monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  // "…, Richmond, VA 23230" → "Richmond, VA"
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "").trim();
    return stateZip ? `${city}, ${stateZip}` : city;
  }
  return address;
}

function mapCellsFromGrid(grid: ProspectAuditKeywordGrid | null): GridCell[] {
  if (!grid?.cells?.length) return [];
  return grid.cells
    .filter(
      (c) =>
        typeof c.lat === "number" &&
        typeof c.lng === "number" &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng)
    )
    .map((c) => ({
      label: c.label,
      lat: c.lat as number,
      lng: c.lng as number,
      rank: c.rank,
      notInResults: c.rank == null,
    }));
}

/** Compact circle grid — only used if geo pins are missing (legacy/partial scans). */
function HeatmapGridFallback({ grid }: { grid: ProspectAuditKeywordGrid }) {
  if (!grid.cells.length) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-[#E6EAF0] bg-[#F9FAFB] text-sm text-[#667085]">
        {grid.status === "running"
          ? "Grid scan running…"
          : "No Maps grid for this keyword yet"}
      </div>
    );
  }
  return (
    <div
      className="mx-auto grid w-full max-w-[320px] gap-1"
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

function hasUsableScanCenter(b: {
  lat: number | null;
  lng: number | null;
}): boolean {
  return (
    b.lat != null &&
    b.lng != null &&
    Number.isFinite(b.lat) &&
    Number.isFinite(b.lng) &&
    !(b.lat === 0 && b.lng === 0)
  );
}

function keywordsFromReport(report: ProspectAuditReport | null): [string, string, string] {
  const kws = report?.scanInfo?.keywords ?? [];
  return [kws[0] ?? "", kws[1] ?? "", kws[2] ?? ""];
}

function resolveViewState(report: ProspectAuditReport): ViewState {
  // Strict: only a finished prospect_audits row shows the report.
  // Safety net: if Maps grids already have cells but status lagged, show completed.
  if (report.status === "ready" || report.status === "shared") return "completed";
  if (report.status === "running") {
    const mapsHaveData = report.keywordGrids.some((g) => g.cells.length > 0);
    const mapsSettled =
      report.keywordGrids.length > 0 &&
      report.keywordGrids.every(
        (g) => g.status === "ready" || g.status === "missing" || g.cells.length > 0
      );
    if (mapsHaveData && mapsSettled) return "completed";
    return "running";
  }
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
  const markedReadyRef = useRef(false);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);

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

  // Prefill address field when setup needs a scan center
  useEffect(() => {
    if (!report) return;
    if (hasUsableScanCenter(report.business)) return;
    if (addressInput.trim()) return;
    const hint = report.business.address?.trim();
    if (hint) setAddressInput(hint);
  }, [report, addressInput]);

  useEffect(() => {
    if (report?.status !== "running") return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [report?.status, load]);

  // Persist completion when Maps already finished but audit row lagged as "running"
  useEffect(() => {
    if (!report?.auditId || report.status !== "running" || markedReadyRef.current) return;
    const mapsHaveData = report.keywordGrids.some((g) => g.cells.length > 0);
    const mapsSettled =
      report.keywordGrids.length > 0 &&
      report.keywordGrids.every(
        (g) => g.status === "ready" || g.status === "missing" || g.cells.length > 0
      );
    if (!mapsHaveData || !mapsSettled) return;
    markedReadyRef.current = true;
    void fetch(`/api/prospect-audits/${report.auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ready" }),
    })
      .then(() => load())
      .catch(() => {
        markedReadyRef.current = false;
      });
  }, [report, load]);

  const viewState: ViewState = forceSetup
    ? "setup"
    : report
      ? resolveViewState(report)
      : "setup";
  const grids = report?.keywordGrids ?? [];
  const safeIdx = Math.min(activeKeywordIdx, Math.max(0, grids.length - 1));
  const activeGrid = grids[safeIdx] ?? null;

  async function verifyScanCenterAddress() {
    const q = addressInput.trim();
    if (!q) {
      setError("Enter a street address, or a city and state, for the scan center.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q }),
      });
      const json = (await res.json()) as {
        error?: string;
        lat?: number;
        lng?: number;
        label?: string;
        displayName?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not find that location");
      if (json.lat == null || json.lng == null) {
        throw new Error("Could not find that location");
      }
      const label = json.displayName ?? json.label ?? q;
      await updateBusinessSettings(businessId, {
        scan_center_lat: json.lat,
        scan_center_lng: json.lng,
        scan_center_label: label,
      });
      setReport((prev) =>
        prev
          ? {
              ...prev,
              business: {
                ...prev.business,
                lat: json.lat!,
                lng: json.lng!,
                address: prev.business.address?.trim() || label,
              },
            }
          : prev
      );
      setShareMsg("Scan center saved on this prospect.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that location");
    } finally {
      setGeocoding(false);
    }
  }

  async function runAudit() {
    const keywords = [kw1, kw2, kw3].map((k) => k.trim()).filter(Boolean).slice(0, 3);
    if (!keywords.length) {
      setError("Add at least one keyword to run the prospect audit.");
      return;
    }
    if (!report || !hasUsableScanCenter(report.business)) {
      setError(
        "Add a scan-center address before running. Service-area listings often hide the street address on Google — we need a city/address so Maps grids land in the right market."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setShareMsg(null);
    setForceSetup(false);
    markedReadyRef.current = false;
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
    const scanReady = hasUsableScanCenter(b);
    const canRun = !busy && !geocoding && !!kw1.trim() && scanReady;
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
                <p className="mt-0.5 text-sm text-[#667085]">
                  {b.address ?? "No public address on Google"}
                </p>
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
            <p className={mock.label}>Scan center address</p>
            {scanReady ? (
              <div className="mt-2 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#027A48]" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#027A48]">Ready for Maps grids</p>
                    <p className="mt-0.5 text-[12px] text-[#027A48]/90">
                      {b.address ?? "Saved scan center on this prospect"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#667085]">
                      Listing address is used when Google shows one. Service-area businesses use the
                      private scan center you saved.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-3 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-3 py-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#93370D]">
                      Address required before you run
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#93370D]/90">
                      This listing has no usable scan center yet (common for service-area businesses
                      that hide the street address on Google). Enter a street address or city &amp;
                      state so ranking grids land in the right market. We save it on the prospect.
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-[#93370D]">
                    Street address or city &amp; state
                  </span>
                  <input
                    className="w-full rounded-lg border border-[#FEC84B] bg-white px-3 py-2 text-sm outline-none focus:border-[#137752]"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void verifyScanCenterAddress();
                      }
                    }}
                    placeholder='e.g. "Richmond, VA" or full street address'
                  />
                </label>
                <button
                  type="button"
                  className={cn(mock.btnSecondary, "disabled:opacity-50")}
                  disabled={geocoding || !addressInput.trim()}
                  onClick={() => void verifyScanCenterAddress()}
                >
                  {geocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Verify &amp; save address
                </button>
              </div>
            )}
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
                {scanReady
                  ? b.address ?? "Saved private scan center"
                  : "Required — add an address above"}
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
            disabled={!canRun}
            onClick={() => void runAudit()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run Prospect Audit
          </button>
          {!scanReady ? (
            <p className="text-center text-[12px] text-[#B54708]">
              Verify a scan-center address to enable Run.
            </p>
          ) : null}
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
                <p className={mock.label}>Optimization Score</p>
                <p className="mt-1 text-sm text-[#667085]">Overall local SEO health</p>
              </div>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Estimated Value / Month</p>
              <p className="text-[26px] font-bold tracking-tight text-[#027A48]">
                {moneyMonth(report.metrics.missedRevenueYear)}
              </p>
              <p className="text-xs text-[#667085]">Impact of ranking &amp; profile gaps</p>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Ads Monthly</p>
              <p className="text-[26px] font-bold tracking-tight text-[#1570EF]">
                {report.metrics.directoriesFound != null
                  ? report.metrics.directoriesFound.toLocaleString()
                  : "—"}
              </p>
              <p className="text-xs text-[#667085]">Estimated local search demand</p>
            </div>
            <div className={cn(mock.cardPad, "space-y-1")}>
              <p className={mock.label}>Keyword</p>
              <p className="text-[16px] font-bold leading-snug text-[#6927DA]">
                {activeGrid?.keyword ?? report.scanInfo.keywords[0] ?? "—"}
              </p>
              <p className="text-xs font-medium text-[#667085]">
                {cityFromAddress(b.address) ?? "—"}
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
              <p className="text-[14px] font-bold text-[#101828]">Audit Results</p>
              <p className="mt-2 text-sm leading-relaxed text-[#475467]">{report.summary}</p>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[15px] font-bold text-[#101828]">Audit checklist</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {report.factors.map((f) => (
                <div key={f.id} className={cn(mock.card, "flex items-center gap-3 p-3.5")}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F9FAFB]">
                    <FactorIcon status={f.status} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#101828]">{f.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#667085]">{f.statusLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="border-b border-[#F2F4F7] px-4 py-3">
                <h2 className="text-[14px] font-bold text-[#101828]">Top Competitors</h2>
                <p className="mt-0.5 text-[12px] text-[#667085]">
                  From Maps listings on this audit
                </p>
              </div>
              {!report.competitors.length ? (
                <p className="px-4 py-6 text-sm text-[#667085]">
                  Competitors appear after a Maps grid finishes.
                </p>
              ) : (
                <ul className="divide-y divide-[#F2F4F7]">
                  {report.competitors.slice(0, 5).map((c, i) => (
                    <li
                      key={`${c.placeId ?? c.cid ?? c.name}-${i}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#101828]">
                          {c.name}
                        </p>
                        {c.avgRank != null ? (
                          <p className="mt-0.5 text-[11px] text-[#667085]">
                            Avg rank {c.avgRank.toFixed(1)}
                          </p>
                        ) : c.category ? (
                          <p className="mt-0.5 truncate text-[11px] text-[#667085]">{c.category}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[16px] font-bold text-[#137752]">
                        {c.score}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={cn(mock.card, "overflow-hidden")}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
                <div>
                  <h2 className="text-[14px] font-bold text-[#101828]">Local Map View</h2>
                  <p className="mt-0.5 text-[12px] text-[#667085]">
                    Ranking heatmap overlaid on the map
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
                    <div className="flex flex-wrap gap-1">
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
                          {g.keyword.length > 20 ? `${g.keyword.slice(0, 18)}…` : g.keyword}
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
              <div className="space-y-3 p-4">
                {(() => {
                  const mapCells = mapCellsFromGrid(activeGrid);
                  const hasGeoPins = mapCells.length > 0;
                  return (
                    <>
                      {b.lat != null && b.lng != null ? (
                        <div className="overflow-hidden rounded-xl ring-1 ring-[#E6EAF0]">
                          <ScanMap
                            officeCenter={[b.lat, b.lng]}
                            cells={mapCells}
                            businessName={b.name}
                            height="380px"
                            gridSize={activeGrid?.gridSize ?? 7}
                            radiusMeters={DEFAULT_RADIUS_METERS}
                          />
                        </div>
                      ) : (
                        <div className="flex h-[380px] items-center justify-center rounded-xl bg-[#F2F4F7] text-sm text-[#667085]">
                          Set a scan center on this prospect to show the map.
                        </div>
                      )}
                      {!hasGeoPins && activeGrid && activeGrid.cells.length > 0 ? (
                        <div className="rounded-xl bg-[#F9FAFB] p-3">
                          <p className="mb-2 text-[11px] font-medium text-[#667085]">
                            Rank grid (map pins unavailable for this scan)
                          </p>
                          <HeatmapGridFallback grid={activeGrid} />
                        </div>
                      ) : null}
                    </>
                  );
                })()}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2.5 text-[12px]">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#667085]">
                    <span>
                      Keyword:{" "}
                      <span className="font-semibold text-[#101828]">
                        {activeGrid?.keyword ?? "—"}
                      </span>
                    </span>
                    <span>
                      Avg rank:{" "}
                      <span className="font-semibold text-[#101828]">
                        {activeGrid?.averageRank != null
                          ? activeGrid.averageRank.toFixed(1)
                          : "—"}
                      </span>
                    </span>
                    {activeGrid?.visibilityScore != null ? (
                      <span>
                        Visibility:{" "}
                        <span className="font-semibold text-[#101828]">
                          {Math.round(activeGrid.visibilityScore)}%
                        </span>
                      </span>
                    ) : null}
                  </div>
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
