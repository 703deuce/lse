"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Image, Loader2, MapPinned } from "lucide-react";
import { btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import type { ReportArtifactKind } from "@/lib/reporting/pdf/constants";

type Props = {
  businessId: string;
  scanBatchId: string;
  className?: string;
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

export function ScanExportMenu({ businessId, scanBatchId, className }: Props) {
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
    if (!jobId || !status) return;
    if (!isTerminalJobStatus(status.status)) return;
    if (status.status !== "completed") {
      setError(status.errorMessage ?? "Export failed");
      setBusyKind(null);
      setJobId(null);
      return;
    }
    const result = (status.result ?? null) as {
      downloadUrl?: string | null;
      downloadPath?: string | null;
    } | null;
    const url = result?.downloadUrl || result?.downloadPath;
    if (url) window.location.href = String(url);
    else setError("Export completed but no download URL was returned");
    setBusyKind(null);
    setJobId(null);
  }, [jobId, status]);

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

      if (json.downloadUrl) {
        window.location.href = String(json.downloadUrl);
        setBusyKind(null);
        return;
      }
      if (json.downloadPath && !json.queued) {
        window.location.href = String(json.downloadPath);
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
      <p className="text-[12px] font-medium text-zinc-700">Scan downloads</p>
      <div className="flex flex-col gap-1.5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const itemBusy = busyKind === item.kind;
          return (
            <button
              key={item.kind}
              type="button"
              disabled={busy}
              onClick={() => void download(item.kind)}
              className={cn(btnSecondary, "h-9 w-full justify-start px-3 text-[13px]")}
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
        <p className="text-[11px] text-zinc-500">Generating… this can take up to a minute.</p>
      ) : null}
    </div>
  );
}
