"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { rep } from "@/components/reputation/rep-ui";
import { cn } from "@/lib/utils";

type SyncResponse = {
  queued?: boolean;
  message?: string;
  error?: string;
  jobs?: Array<{ kind: string; queued: boolean; skipped?: string }>;
};

export function ReputationSyncButton({
  businessId,
  className,
  label = "Refresh Reputation Data",
  variant = "primary",
  onQueued,
}: {
  businessId: string;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary";
  onQueued?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/reputation/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, forceRefresh: true }),
      });
      const json = (await res.json()) as SyncResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to queue reputation sync");
      }
      setMessage(
        json.message ??
          "Sync queued. Charts and review stats will update when the run finishes."
      );
      onQueued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue reputation sync");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void runSync()}
        disabled={running}
        className={cn(
          variant === "primary" ? rep.btnPrimary : rep.btnSecondary,
          "disabled:opacity-60"
        )}
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {running ? "Queuing sync…" : label}
      </button>
      {message ? <p className="text-xs font-medium text-[#027A48]">{message}</p> : null}
      {error ? <p className="text-xs font-medium text-[#B42318]">{error}</p> : null}
    </div>
  );
}

export function ReputationEmptySyncState({
  businessId,
  title,
  description,
}: {
  businessId: string;
  title: string;
  description: string;
}) {
  return (
    <div className={cn(rep.card, "flex flex-col items-center gap-4 px-6 py-16 text-center")}>
      <div>
        <h2 className="text-lg font-semibold text-[#101828]">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-[#667085]">{description}</p>
      </div>
      <ReputationSyncButton businessId={businessId} />
    </div>
  );
}
