"use client";

import { useState } from "react";
import { Loader2, FileDown, Link2 } from "lucide-react";
import { ContentCard, EmptyState, ModuleHeader, ModulePage, btnPrimary } from "@/components/ui/design-system";

export function ReportsPanel({
  businessId,
  latestScanId,
}: {
  businessId: string;
  latestScanId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function exportReport() {
    if (!latestScanId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, scanBatchId: latestScanId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShareUrl(data.shareUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModulePage className="!space-y-4">
      <ModuleHeader
        title="Reports"
        subtitle="Export shareable visibility reports for your business or clients."
        className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      />

      {!latestScanId ? (
        <EmptyState
          title="No completed scans yet"
          description="Run a grid scan first — reports are generated from your latest scan results."
        />
      ) : (
        <ContentCard className="max-w-xl !p-3.5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileDown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-zinc-900">Visibility report</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                Generates a shareable PDF from your latest grid scan — rankings, coverage, and
                competitor comparison.
              </p>
              <button
                type="button"
                onClick={exportReport}
                disabled={loading}
                className={`mt-4 ${btnPrimary}`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Export PDF report
              </button>
              {shareUrl && (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-zinc-600">
                  <Link2 className="h-4 w-4 shrink-0 text-zinc-400" />
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
            </div>
          </div>
        </ContentCard>
      )}
    </ModulePage>
  );
}
