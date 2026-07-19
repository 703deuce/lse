"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnSecondary } from "@/components/ui/design-system";

export function CancelActiveScansButton({
  className,
  label = "Cancel all running scans",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onCancel() {
    if (
      !confirm(
        "Cancel every queued/running Maps scan and turn off campaign schedules? This cannot be undone for those scans."
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/scans/cancel-active", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Could not cancel scans");
      }
      setMessage(
        `Cancelled ${json.cancelledScans ?? 0} scan(s). Schedules turned off.`
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onCancel()}
        className={cn(
          btnSecondary,
          "h-9 border-red-200 bg-red-50 px-3 text-[13px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Square className="h-3.5 w-3.5 fill-current" />
        )}
        {label}
      </button>
      {message ? <p className="max-w-xs text-right text-[11px] text-zinc-600">{message}</p> : null}
    </div>
  );
}

export function CancelScanButton({
  scanId,
  className,
}: {
  scanId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onCancel() {
    if (!confirm("Cancel this scan?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/scans/${scanId}/cancel`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not cancel");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onCancel()}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[12px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50",
        className
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3 w-3 fill-current" />}
      Cancel
    </button>
  );
}
