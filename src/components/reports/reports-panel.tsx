"use client";

import { useState } from "react";
import { Loader2, FileDown, Link2, Ban } from "lucide-react";
import { ContentCard, EmptyState, ModuleHeader, ModulePage, btnPrimary, btnSecondary } from "@/components/ui/design-system";

export function ReportsPanel({
  businessId,
  latestScanId,
}: {
  businessId: string;
  latestScanId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportReport() {
    if (!latestScanId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, scanBatchId: latestScanId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShareUrl(data.shareUrl);
      setReportId(data.reportId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  async function revokeShare() {
    if (!reportId) return;
    setRevoking(true);
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
      setRevoking(false);
    }
  }

  return (
    <ModulePage>
      <ModuleHeader
        title="Reports"
        subtitle="Export shareable visibility reports for your business or clients."
      />

      {!latestScanId ? (
        <EmptyState
          title="No completed scans yet"
          description="Run a grid scan first — reports are generated from your latest scan results."
        />
      ) : (
        <ContentCard className="max-w-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileDown className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-semibold text-zinc-900">Visibility report</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">
                Generates a shareable PDF from your latest grid scan — rankings, coverage, and
                competitor comparison.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportReport}
                  disabled={loading}
                  className={`h-9 px-3 text-[13px] ${btnPrimary}`}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  Export PDF report
                </button>
                {reportId && shareUrl ? (
                  <button
                    type="button"
                    onClick={() => void revokeShare()}
                    disabled={revoking}
                    className={`h-9 px-3 text-[13px] ${btnSecondary}`}
                  >
                    {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    Revoke share link
                  </button>
                ) : null}
              </div>
              {shareUrl && (
                <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-zinc-600">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <a
                    href={shareUrl}
                    className="truncate font-medium text-emerald-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shareUrl}
                  </a>
                </p>
              )}
              {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            </div>
          </div>
        </ContentCard>
      )}
    </ModulePage>
  );
}
