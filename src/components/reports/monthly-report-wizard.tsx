"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Link2,
} from "lucide-react";
import {
  ContentCard,
  btnPrimary,
  btnSecondary,
  fieldLabelClass,
  inputClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  type ReportSectionId,
} from "@/lib/reporting/report-sections";
import { ReportShareControls } from "@/components/reports/report-share-controls";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import { SUMMARY_TONES, type SummaryTone } from "@/lib/reporting/ai-executive-summary";

type ScanOption = {
  id: string;
  keyword: string;
  keywordId: string | null;
  locationId: string | null;
  gridSize: number;
  radiusMeters: number;
  scannedAt: string;
  averageRank: number | null;
};

type Step = "period" | "confirm" | "narrative" | "preview" | "publish";

const STEPS: Step[] = ["period", "confirm", "narrative", "preview", "publish"];

const WIZARD_SECTIONS: ReportSectionId[] = [
  "cover",
  "executive_summary",
  "maps_overview",
  "comparison",
  "trend",
  "ai_visibility",
  "work_completed",
  "freelancer_notes",
  "next_steps",
  "footer",
];

function monthBounds(offsetMonths: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 0, 23, 59, 59));
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from: start.toISOString(), to: end.toISOString(), label };
}

export function MonthlyReportWizard({
  businessId,
  scans,
  keywords,
}: {
  businessId: string;
  scans: ScanOption[];
  keywords: Array<{ id: string; keyword: string; isPrimary: boolean }>;
}) {
  const [step, setStep] = useState<Step>("period");
  const [periodPreset, setPeriodPreset] = useState<"this" | "last" | "custom">("this");
  const thisMonth = useMemo(() => monthBounds(0), []);
  const lastMonth = useMemo(() => monthBounds(-1), []);
  const [dateFrom, setDateFrom] = useState(thisMonth.from.slice(0, 10));
  const [dateTo, setDateTo] = useState(thisMonth.to.slice(0, 10));
  const [periodLabel, setPeriodLabel] = useState(thisMonth.label);
  const [scanId, setScanId] = useState(scans[0]?.id ?? "");
  const [summary, setSummary] = useState("");
  const [tone, setTone] = useState<SummaryTone>("professional");
  const [workCompleted, setWorkCompleted] = useState("");
  const [freelancerNotes, setFreelancerNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [sections, setSections] = useState<Partial<Record<ReportSectionId, boolean>>>({
    ...DEFAULT_REPORT_SECTIONS,
    ai_visibility: false,
    work_completed: true,
    freelancer_notes: true,
    next_steps: true,
  });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    arp: number | null;
    keywordCount: number | null;
    hasComparison: boolean;
    hasAiVisibility: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [shareJobId, setShareJobId] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const selectedScan = useMemo(
    () => scans.find((s) => s.id === scanId) ?? scans[0] ?? null,
    [scans, scanId]
  );

  const resolvedKeywordId = useMemo(() => {
    if (!selectedScan) return null;
    if (selectedScan.keywordId) return selectedScan.keywordId;
    const match = keywords.find(
      (k) => k.keyword.trim().toLowerCase() === selectedScan.keyword.trim().toLowerCase()
    );
    return match?.id ?? null;
  }, [selectedScan, keywords]);

  const priorScan = useMemo(() => {
    if (!selectedScan) return null;
    const same = scans.filter(
      (s) =>
        s.id !== selectedScan.id &&
        (selectedScan.keywordId
          ? s.keywordId === selectedScan.keywordId
          : s.keyword.trim().toLowerCase() === selectedScan.keyword.trim().toLowerCase()) &&
        s.locationId === selectedScan.locationId
    );
    return same[0] ?? null;
  }, [scans, selectedScan]);

  useEffect(() => {
    if (periodPreset === "this") {
      setDateFrom(thisMonth.from.slice(0, 10));
      setDateTo(thisMonth.to.slice(0, 10));
      setPeriodLabel(thisMonth.label);
    } else if (periodPreset === "last") {
      setDateFrom(lastMonth.from.slice(0, 10));
      setDateTo(lastMonth.to.slice(0, 10));
      setPeriodLabel(lastMonth.label);
    }
  }, [periodPreset, thisMonth, lastMonth]);

  // Auto-select sections from cross-tool "Add to report" staging + available data.
  useEffect(() => {
    void import("@/lib/journey/report-staging").then(({ listStagedReportItems }) => {
      const staged = listStagedReportItems(businessId);
      if (!staged.length) return;
      setSections((prev) => {
        const next = { ...prev };
        for (const item of staged) {
          if (item.source === "ai_visibility") next.ai_visibility = true;
          if (item.source === "maps_scan") {
            next.maps_overview = true;
            next.comparison = true;
          }
          if (
            item.source === "growth_audit" ||
            item.source === "backlink_gap" ||
            item.source === "local_trust" ||
            item.source === "reviews"
          ) {
            next.work_completed = true;
            next.next_steps = true;
          }
          if (item.source === "keywords") next.freelancer_notes = true;
        }
        return next;
      });
      const notes = staged
        .map((s) => `• ${s.title} (${s.source.replace(/_/g, " ")})`)
        .join("\n");
      setFreelancerNotes((prev) => (prev.trim() ? prev : `Staged from tools:\n${notes}`));
      setWorkCompleted((prev) =>
        prev.trim()
          ? prev
          : staged
              .filter((s) =>
                ["growth_audit", "backlink_gap", "local_trust", "reviews"].includes(s.source)
              )
              .map((s) => `• ${s.title}`)
              .join("\n")
      );
    });
  }, [businessId]);

  const { status: shareJobStatus, error: sharePollError } = useActiveJobStatus({
    statusUrl: shareJobId ? `/api/jobs/${shareJobId}/status` : null,
    enabled: Boolean(shareJobId),
  });

  useEffect(() => {
    if (sharePollError) {
      setError(sharePollError);
      setBusy(null);
      setShareJobId(null);
    }
  }, [sharePollError]);

  useEffect(() => {
    if (!shareJobId || !shareJobStatus) return;
    if (!isTerminalJobStatus(shareJobStatus.status)) return;
    if (shareJobStatus.status !== "completed") {
      setError(shareJobStatus.errorMessage ?? "Report generation failed");
      setBusy(null);
      setShareJobId(null);
      return;
    }
    const result = (shareJobStatus.result ?? null) as {
      shareUrl?: string | null;
      reportId?: string | null;
    } | null;
    if (result?.shareUrl) setShareUrl(String(result.shareUrl));
    if (result?.reportId) setReportId(String(result.reportId));
    setBusy(null);
    setShareJobId(null);
    setStep("publish");
  }, [shareJobId, shareJobStatus]);

  function isoRange() {
    const from = new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
    const to = new Date(`${dateTo}T23:59:59.999Z`).toISOString();
    return { from, to };
  }

  async function buildPreview() {
    if (!resolvedKeywordId || !selectedScan) {
      setError("Select an anchor scan with a resolvable keyword");
      return;
    }
    setBusy("preview");
    setError(null);
    try {
      const { from, to } = isoRange();
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reportType: "trend",
          format: "preview",
          keywordId: resolvedKeywordId,
          locationId: selectedScan.locationId,
          gridSize: selectedScan.gridSize,
          radiusMeters: selectedScan.radiusMeters,
          dateFrom: from,
          dateTo: to,
          periodLabel,
          executiveSummary: summary || null,
          sections,
          workCompleted: workCompleted || null,
          freelancerNotes: freelancerNotes || null,
          nextSteps: nextSteps || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreviewHtml(String(json.html ?? ""));
      setPreviewMeta(json.summary ?? null);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateSummary() {
    setBusy("summary");
    setError(null);
    try {
      const res = await fetch("/api/reports/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          tone,
          keyword: selectedScan?.keyword,
          reportLabel: "Monthly client report",
          kpis: {
            arp: selectedScan?.averageRank ?? null,
          },
          priorKpis: {
            arp: priorScan?.averageRank ?? null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Summary failed");
      if (typeof json.summary === "string") setSummary(json.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish(as: "draft" | "published") {
    if (!resolvedKeywordId || !selectedScan) {
      setError("Select an anchor scan with a resolvable keyword");
      return;
    }
    setBusy("publish");
    setError(null);
    setShareUrl(null);
    setReportId(null);
    try {
      const { from, to } = isoRange();
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reportType: "trend",
          format: "share",
          force: true,
          keywordId: resolvedKeywordId,
          locationId: selectedScan.locationId,
          gridSize: selectedScan.gridSize,
          radiusMeters: selectedScan.radiusMeters,
          dateFrom: from,
          dateTo: to,
          periodLabel,
          executiveSummary: summary || null,
          sections,
          workCompleted: workCompleted || null,
          freelancerNotes: freelancerNotes || null,
          nextSteps: nextSteps || null,
          publishStatus: as,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      if (json.reportId) setReportId(String(json.reportId));
      // Draft links are not publicly viewable until publish_status=published.
      if (as === "published" && json.shareUrl) setShareUrl(String(json.shareUrl));
      if (as === "draft") setShareUrl(null);
      if (json.queued && typeof json.jobId === "string") {
        setShareJobId(String(json.jobId));
        return;
      }
      setStep("publish");
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!resolvedKeywordId || !selectedScan) return;
    setBusy("pdf");
    setError(null);
    try {
      const { from, to } = isoRange();
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reportType: "trend",
          format: "pdf",
          force: true,
          keywordId: resolvedKeywordId,
          locationId: selectedScan.locationId,
          gridSize: selectedScan.gridSize,
          radiusMeters: selectedScan.radiusMeters,
          dateFrom: from,
          dateTo: to,
          periodLabel,
          executiveSummary: summary || null,
          sections,
          workCompleted: workCompleted || null,
          freelancerNotes: freelancerNotes || null,
          nextSteps: nextSteps || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "PDF failed");
      const path = json.downloadPath || json.downloadUrl;
      if (!path) throw new Error("No download URL returned");
      setPdfPath(String(path));
      if (String(path).startsWith("http")) {
        window.open(String(path), "_blank", "noopener,noreferrer");
      } else {
        const dl = await fetch(String(path), { credentials: "same-origin" });
        if (!dl.ok) throw new Error("PDF download failed");
        const blob = await dl.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `monthly-report-${periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setBusy(null);
    }
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <ContentCard className="space-y-4">
      <div>
        <h2 className="text-[14px] font-semibold text-zinc-900">Monthly client report</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          Period → confirm scans → summary → preview → publish. One path for the client deliverable.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-[11px]">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-md border px-2 py-1 capitalize",
              i === stepIndex
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : i < stepIndex
                  ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                  : "border-zinc-100 text-zinc-400"
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === "period" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["this", "This month"],
                ["last", "Last month"],
                ["custom", "Custom"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriodPreset(id)}
                className={cn(
                  btnSecondary,
                  "h-8 px-3 text-[12px]",
                  periodPreset === id && "border-emerald-300 bg-emerald-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClass}>From</label>
              <input
                type="date"
                className={cn(inputClass, "mt-1")}
                value={dateFrom}
                onChange={(e) => {
                  setPeriodPreset("custom");
                  setDateFrom(e.target.value);
                }}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>To</label>
              <input
                type="date"
                className={cn(inputClass, "mt-1")}
                value={dateTo}
                onChange={(e) => {
                  setPeriodPreset("custom");
                  setDateTo(e.target.value);
                }}
              />
            </div>
          </div>
          <div>
            <label className={fieldLabelClass}>Period label on cover</label>
            <input
              className={cn(inputClass, "mt-1")}
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            onClick={() => setStep("confirm")}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-3">
          <div>
            <label className={fieldLabelClass}>Anchor scan (keyword / grid)</label>
            <select
              className={cn(inputClass, "mt-1")}
              value={selectedScan?.id ?? ""}
              onChange={(e) => setScanId(e.target.value)}
            >
              {scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.keyword} · {s.gridSize}×{s.gridSize} ·{" "}
                  {new Date(s.scannedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[12px] text-zinc-700">
            <p>
              <span className="font-medium">Latest:</span>{" "}
              {selectedScan
                ? `${selectedScan.keyword} · ARP ${selectedScan.averageRank ?? "—"} · ${new Date(selectedScan.scannedAt).toLocaleDateString()}`
                : "—"}
            </p>
            <p className="mt-1">
              <span className="font-medium">Prior (auto):</span>{" "}
              {priorScan
                ? `${priorScan.keyword} · ARP ${priorScan.averageRank ?? "—"} · ${new Date(priorScan.scannedAt).toLocaleDateString()}`
                : "Need a second scan for before/after"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("period")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={!resolvedKeywordId}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("narrative")}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "narrative" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem]">
              <label className={fieldLabelClass}>Tone</label>
              <select
                className={cn(inputClass, "mt-1")}
                value={tone}
                onChange={(e) => setTone(e.target.value as SummaryTone)}
              >
                {SUMMARY_TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void generateSummary()}
              className={cn(btnSecondary, "h-9 px-3 text-[12px]")}
            >
              {busy === "summary" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Draft summary
            </button>
          </div>
          <div>
            <label className={fieldLabelClass}>Executive summary</label>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[88px]")}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Plain-language wins, risks, and what changed this period."
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Work completed</label>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[64px]")}
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Freelancer notes</label>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[64px]")}
              value={freelancerNotes}
              onChange={(e) => setFreelancerNotes(e.target.value)}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Next steps</label>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[64px]")}
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
            />
          </div>
          <div>
            <p className={fieldLabelClass}>Sections</p>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {WIZARD_SECTIONS.map((id) => (
                <label key={id} className="flex items-center gap-2 text-[12px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={sections[id] !== false}
                    onChange={(e) =>
                      setSections((prev) => ({ ...prev, [id]: e.target.checked }))
                    }
                  />
                  {REPORT_SECTION_LABELS[id]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("confirm")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={busy != null}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void buildPreview()}
            >
              {busy === "preview" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Preview report
            </button>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-3">
          {previewMeta ? (
            <p className="text-[12px] text-zinc-600">
              Avg. rank {previewMeta.arp ?? "—"}
              {previewMeta.keywordCount != null
                ? ` · ${previewMeta.keywordCount} series points`
                : ""}
              {previewMeta.hasComparison ? " · before/after included" : ""}
              {previewMeta.hasAiVisibility ? " · AI visibility data" : ""}
            </p>
          ) : null}
          {previewHtml ? (
            <iframe
              title="Report preview"
              className="h-[420px] w-full rounded-lg border border-zinc-200 bg-white"
              srcDoc={previewHtml}
              sandbox=""
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("narrative")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              disabled={busy != null}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => void publish("draft")}
            >
              {busy === "publish" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save draft
            </button>
            <button
              type="button"
              disabled={busy != null}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void publish("published")}
            >
              {busy === "publish" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Publish share link
            </button>
            <button
              type="button"
              disabled={busy != null}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => void downloadPdf()}
            >
              {busy === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Download PDF
            </button>
          </div>
        </div>
      ) : null}

      {step === "publish" ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
            <Check className="h-4 w-4" /> Report ready
          </p>
          {shareUrl ? (
            <>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnSecondary, "h-9 w-full justify-center px-3 text-[13px]")}
              >
                Open shared report
              </a>
              <p className="break-all text-[11px] text-zinc-500">{shareUrl}</p>
            </>
          ) : reportId ? (
            <p className="text-[12px] text-zinc-600">
              Draft saved. Use share controls below to publish when the client is ready.
            </p>
          ) : (
            <p className="text-[12px] text-zinc-500">
              {busy === "publish" || shareJobId
                ? "Creating share link…"
                : "Publish from preview to create a client link."}
            </p>
          )}
          {reportId ? (
            <ReportShareControls
              businessId={businessId}
              reportId={reportId}
              shareUrl={shareUrl}
              onShareUrlChange={setShareUrl}
              keyword={selectedScan?.keyword}
              reportLabel="Monthly client report"
              kpis={{ arp: selectedScan?.averageRank ?? null }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => void downloadPdf()}
            >
              {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Download PDF
            </button>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => {
                setStep("period");
                setShareUrl(null);
                setReportId(null);
                setPreviewHtml(null);
                setPdfPath(null);
              }}
            >
              Start another
            </button>
          </div>
          {pdfPath ? (
            <p className="text-[11px] text-zinc-500">Last PDF: {pdfPath}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
    </ContentCard>
  );
}
