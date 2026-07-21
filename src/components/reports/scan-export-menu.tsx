"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Image, Loader2, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import type { ReportArtifactKind } from "@/lib/reporting/pdf/constants";
import { artifactFileExtension } from "@/lib/reporting/pdf/constants";

type Props = {
  businessId: string;
  scanBatchId: string;
  className?: string;
  /** Horizontal footer row (mockup) or stacked list. */
  layout?: "stack" | "row";
};

const ITEMS: Array<{
  kind: ReportArtifactKind;
  label: string;
  icon: typeof FileText;
}> = [
  { kind: "pdf", label: "Download PDF Report", icon: FileText },
  { kind: "map_png", label: "Download Map Image", icon: MapPinned },
  { kind: "heatmap_png", label: "Download Heatmap Image", icon: Image },
  { kind: "summary_csv", label: "Download Scan Summary CSV", icon: Download },
  { kind: "points_csv", label: "Download Data Points CSV", icon: Download },
];

async function downloadSameOrigin(path: string, filename: string) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ScanExportMenu({
  businessId,
  scanBatchId,
  className,
  layout = "stack",
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<ReportArtifactKind | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const { status, error: pollError } = useActiveJobStatus({
    statusUrl: jobId ? `/api/jobs/${jobId}/status` : null,
    enabled: Boolean(jobId),
  });

  useEffect(() => {
    if (pollError) {
      setError(pollError);
      setBusyKind(null);
      setJobId(null);
    }
  }, [pollError]);

  useEffect(() => {
    if (!jobId || !status || !busyKind) return;
    if (!isTerminalJobStatus(status.status)) return;
    if (status.status !== "completed") {
      setError(status.errorMessage ?? "Export failed");
      setBusyKind(null);
      setJobId(null);
      return;
    }
    const result = (status.result ?? null) as {
      downloadPath?: string | null;
      reportId?: string | null;
    } | null;
    const path =
      result?.downloadPath ||
      (result?.reportId ? `/api/reports/artifacts/${result.reportId}/download` : null);
    if (!path) {
      setError("Export completed but no download path was returned");
      setBusyKind(null);
      setJobId(null);
      return;
    }
    const kind = busyKind;
    void downloadSameOrigin(path, `scan-export.${artifactFileExtension(kind)}`)
      .catch((e) => setError(e instanceof Error ? e.message : "Download failed"))
      .finally(() => {
        setBusyKind(null);
        setJobId(null);
      });
  }, [jobId, status, busyKind]);

  async function download(kind: ReportArtifactKind) {
    setError(null);
    setBusyKind(kind);
    try {
      const res = await fetch("/api/reports/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          scanBatchId,
          kind,
          competitorLimit: 20,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Export failed");

      // Always prefer same-origin downloadPath — never navigate to external signed URLs.
      const path =
        (typeof json.downloadPath === "string" && json.downloadPath) ||
        (typeof json.reportId === "string"
          ? `/api/reports/artifacts/${json.reportId}/download`
          : null);

      if (path && !json.queued) {
        await downloadSameOrigin(path, `scan-export.${artifactFileExtension(kind)}`);
        setBusyKind(null);
        return;
      }
      if (json.queued && typeof json.jobId === "string") {
        setJobId(json.jobId);
        return;
      }
      setError("Unexpected export response");
      setBusyKind(null);
    } catch (e) {
      setBusyKind(null);
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const busy = busyKind != null;

  return (
    <div className={cn("space-y-2", className)}>
      {layout === "stack" ? (
        <p className="text-[12px] font-medium text-[#344054]">Scan downloads</p>
      ) : null}
      <div
        className={cn(
          layout === "row"
            ? "flex flex-wrap items-center gap-2"
            : "flex flex-col gap-1.5"
        )}
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const itemBusy = busyKind === item.kind;
          return (
            <button
              key={item.kind}
              type="button"
              disabled={busy}
              onClick={() => void download(item.kind)}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:opacity-60",
                layout === "stack" && "w-full justify-start"
              )}
            >
              {itemBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {item.label}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      {busyKind && jobId ? (
        <p className="text-[11px] text-[#667085]">Generating… this can take up to a minute.</p>
      ) : null}
    </div>
  );
}
