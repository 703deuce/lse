"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import {
  btnPrimary,
  btnSecondary,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export function ConvertToClientWizard({
  businessId,
  businessName,
  onClose,
}: {
  businessId: string;
  businessName: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState({
    keepKeywords: true,
    createCampaign: true,
    markBaseline: true,
    setSchedule: false,
    keepReports: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/convert-to-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepKeywords: options.keepKeywords,
          createCampaign: options.createCampaign,
          markBaseline: options.markBaseline,
          setSchedule: options.setSchedule,
          keepReports: options.keepReports,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Convert failed");
      router.push(`/clients/${businessId}?setup=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Convert failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-zinc-900">
            Convert {businessName} to client
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-600">
            Preserve history and set up ongoing tracking in one step.
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-[12px] text-zinc-500 hover:underline">
            Cancel
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        {(
          [
            ["keepKeywords", "Keep existing keywords"],
            ["createCampaign", "Create Maps campaign from prospect scans"],
            ["markBaseline", "Mark current scan as baseline"],
            ["setSchedule", "Prompt me to set a scan schedule next"],
            ["keepReports", "Keep existing reports in client history"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-[13px] text-zinc-800">
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) =>
                setOptions((o) => ({ ...o, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </div>

      {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        {onClose ? (
          <button
            type="button"
            className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            onClick={onClose}
          >
            Not yet
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
          onClick={() => void convert()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          Convert to client
        </button>
      </div>
    </div>
  );
}
