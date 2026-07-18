"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { btnSecondary, fieldLabelClass, inputClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import {
  REPORT_SECTION_LABELS,
  type ReportSectionId,
} from "@/lib/reporting/report-sections";
import { SUMMARY_TONES, type SummaryTone } from "@/lib/reporting/ai-executive-summary";

type ShareState = {
  shareUrl: string | null;
  expiresAt: string | null;
  hasPassword: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  publishStatus: "draft" | "published" | "archived";
};

const TOGGLE_SECTIONS: ReportSectionId[] = [
  "executive_summary",
  "maps_overview",
  "maps_grid",
  "comparison",
  "trend",
  "competitors",
  "ai_visibility",
  "review_snapshot",
  "work_completed",
  "freelancer_notes",
  "next_steps",
];

export function ReportShareControls({
  businessId,
  reportId,
  shareUrl,
  onShareUrlChange,
  kpis,
  keyword,
  reportLabel,
}: {
  businessId: string;
  reportId: string;
  shareUrl: string | null;
  onShareUrlChange?: (url: string | null) => void;
  kpis?: {
    arp?: number | null;
    top3Pct?: number | null;
    visibilityScore?: number | null;
  };
  keyword?: string | null;
  reportLabel?: string;
}) {
  const [share, setShare] = useState<ShareState | null>(null);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [tone, setTone] = useState<SummaryTone>("professional");
  const [sections, setSections] = useState<Partial<Record<ReportSectionId, boolean>>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reports/share-settings?businessId=${businessId}&reportId=${reportId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load share settings");
      const r = json.report as ShareState & { metadata?: Record<string, unknown> };
      setShare({
        shareUrl: r.shareUrl,
        expiresAt: r.expiresAt,
        hasPassword: r.hasPassword,
        viewCount: r.viewCount,
        lastViewedAt: r.lastViewedAt,
        publishStatus: r.publishStatus,
      });
      if (r.expiresAt) setExpiresAt(String(r.expiresAt).slice(0, 16));
      else setExpiresAt("");
      const meta = r.metadata ?? {};
      if (typeof meta.executiveSummary === "string") setSummary(meta.executiveSummary);
      if (typeof meta.summaryTone === "string") setTone(meta.summaryTone as SummaryTone);
      if (meta.sections && typeof meta.sections === "object") {
        setSections(meta.sections as Partial<Record<ReportSectionId, boolean>>);
      }
      if (r.shareUrl) onShareUrlChange?.(r.shareUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load share settings");
    }
  }, [businessId, reportId, onShareUrlChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy("patch");
    setError(null);
    try {
      const res = await fetch("/api/reports/share-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reportId, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      const r = json.report as ShareState;
      setShare(r);
      if (r.shareUrl) onShareUrlChange?.(r.shareUrl);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
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
          reportId,
          tone,
          save: true,
          keyword,
          reportLabel: reportLabel ?? "Client report",
          kpis,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Summary failed");
      setSummary(String(json.summary ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveSummary() {
    setBusy("save-summary");
    setError(null);
    try {
      const res = await fetch("/api/reports/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reportId,
          tone,
          summary,
          save: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    const url = share?.shareUrl || shareUrl;
    if (!url) return;
    const absolute =
      url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      void fetch("/api/reports/share-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reportId }),
      }).catch(() => undefined);
      // Fire-and-forget analytics via a tiny side channel on copy
      void fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "report_share_link_copied",
          businessId,
          reportId,
        }),
      }).catch(() => undefined);
    } catch {
      setError("Could not copy link");
    }
  }

  const displayUrl = share?.shareUrl || shareUrl;

  return (
    <div className="mt-4 space-y-4 border-t border-zinc-100 pt-3">
      <div>
        <p className="text-[12px] font-semibold text-zinc-800">Share controls</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Password, expiry, publish state, and view count for this client link.
        </p>
      </div>

      {displayUrl ? (
        <div className="space-y-2">
          <p className="break-all text-[11px] text-zinc-500">{displayUrl}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className={cn(btnSecondary, "h-8 px-2.5 text-[12px]")}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void patch({ regenerate: true })}
              className={cn(btnSecondary, "h-8 px-2.5 text-[12px]")}
            >
              {busy === "patch" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate link
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Views: {share?.viewCount ?? 0}
            {share?.lastViewedAt
              ? ` · Last viewed ${new Date(share.lastViewedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
      ) : null}

      <div>
        <label className={fieldLabelClass}>Link password</label>
        <div className="mt-1 flex gap-2">
          <input
            type="password"
            className={cn(inputClass, "flex-1")}
            placeholder={share?.hasPassword ? "••••••••" : "Optional password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            disabled={busy != null || password.length < 4}
            onClick={() => void patch({ password })}
            className={cn(btnSecondary, "h-9 shrink-0 px-2.5 text-[12px]")}
          >
            Set
          </button>
          {share?.hasPassword ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void patch({ clearPassword: true })}
              className={cn(btnSecondary, "h-9 shrink-0 px-2.5 text-[12px]")}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <label className={fieldLabelClass}>Expires</label>
        <div className="mt-1 flex gap-2">
          <input
            type="datetime-local"
            className={cn(inputClass, "flex-1")}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <button
            type="button"
            disabled={busy != null}
            onClick={() =>
              void patch({
                expiresAt: expiresAt
                  ? new Date(expiresAt).toISOString()
                  : null,
              })
            }
            className={cn(btnSecondary, "h-9 shrink-0 px-2.5 text-[12px]")}
          >
            Save
          </button>
        </div>
      </div>

      <div>
        <label className={fieldLabelClass}>Publish status</label>
        <select
          className={cn(inputClass, "mt-1")}
          value={share?.publishStatus ?? "published"}
          disabled={busy != null}
          onChange={(e) =>
            void patch({
              publishStatus: e.target.value as ShareState["publishStatus"],
            })
          }
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-zinc-800">Executive summary</p>
        <label className={cn(fieldLabelClass, "mt-2")}>Tone</label>
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
        <textarea
          className={cn(inputClass, "mt-2 min-h-[88px] resize-y")}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Generate or write a short client-facing summary…"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void generateSummary()}
            className={cn(btnSecondary, "h-8 px-2.5 text-[12px]")}
          >
            {busy === "summary" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Generate summary
          </button>
          <button
            type="button"
            disabled={busy != null || !summary.trim()}
            onClick={() => void saveSummary()}
            className={cn(btnSecondary, "h-8 px-2.5 text-[12px]")}
          >
            {busy === "save-summary" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save summary
          </button>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-zinc-800">Sections</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Preferences are saved on the report for the next regenerate.
        </p>
        <ul className="mt-2 space-y-1.5">
          {TOGGLE_SECTIONS.map((id) => {
            const on = sections[id] !== false;
            return (
              <li key={id} className="flex items-center gap-2 text-[12px] text-zinc-700">
                <input
                  id={`sec-${id}`}
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    const next = { ...sections, [id]: e.target.checked };
                    setSections(next);
                    void persistSections(businessId, reportId, next);
                  }}
                />
                <label htmlFor={`sec-${id}`}>{REPORT_SECTION_LABELS[id]}</label>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}

async function persistSections(
  businessId: string,
  reportId: string,
  sections: Partial<Record<ReportSectionId, boolean>>
) {
  try {
    await fetch("/api/reports/sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, reportId, sections }),
    });
  } catch {
    /* best-effort */
  }
}
