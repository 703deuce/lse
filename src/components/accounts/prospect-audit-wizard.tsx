"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react";
import {
  btnPrimary,
  btnSecondary,
  fieldLabelClass,
  inputClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Step = "keywords" | "modules" | "run" | "done";

export function ProspectAuditWizard({
  businessId,
  businessName,
  onClose,
}: {
  businessId: string;
  businessName: string;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<Step>("keywords");
  const [keywords, setKeywords] = useState("");
  const [modules, setModules] = useState({
    maps: true,
    growthAudit: true,
    competitors: true,
    aiVisibility: false,
    reviews: false,
    backlinks: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<string[]>([]);

  async function runAudit() {
    setBusy(true);
    setError(null);
    const launched: string[] = [];
    try {
      const lines = keywords
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const primary = lines[0];

      if (modules.maps && primary) {
        const res = await fetch("/api/scans/run-for-keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            keyword: primary,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to start Maps scan");
        }
        launched.push("Maps visibility scan");
      }

      if (modules.growthAudit) {
        const res = await fetch("/api/growth-audit/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId }),
        });
        if (res.ok) launched.push("Growth Audit");
        else {
          // Non-fatal — route may differ by deployment
          launched.push("Growth Audit (open tab to run)");
        }
      }

      if (modules.aiVisibility) {
        const res = await fetch("/api/ai-visibility/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId }),
        });
        if (res.ok) launched.push("AI Visibility check");
      }

      setStarted(launched);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed to start");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-zinc-900">
            Prospect audit — {businessName}
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-600">
            Guided workflow: keywords → modules → run → create report.
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-[12px] text-zinc-500 hover:underline">
            Close
          </button>
        ) : null}
      </div>

      {step === "keywords" ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className={fieldLabelClass}>Keywords (one per line)</span>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[96px] bg-white")}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={"roofing contractor\nroof repair near me\nroofing in austin"}
            />
          </label>
          <button
            type="button"
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            disabled={!keywords.trim()}
            onClick={() => setStep("modules")}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {step === "modules" ? (
        <div className="space-y-3">
          <p className={fieldLabelClass}>Include in this audit</p>
          {(
            [
              ["maps", "Maps visibility"],
              ["growthAudit", "Growth Audit"],
              ["competitors", "Competitor comparison"],
              ["aiVisibility", "AI visibility"],
              ["reviews", "Review snapshot"],
              ["backlinks", "Backlink opportunities"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-[13px] text-zinc-800">
              <input
                type="checkbox"
                checked={modules[key]}
                onChange={(e) =>
                  setModules((m) => ({ ...m, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("keywords")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("run")}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "run" ? (
        <div className="space-y-3">
          <p className="text-[13px] text-zinc-700">
            Ready to queue selected modules. Work continues in the background.
          </p>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("modules")}
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void runAudit()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              Run prospect audit
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-emerald-800">Audit started</p>
          <ul className="list-disc pl-5 text-[12px] text-zinc-700">
            {started.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/businesses/${businessId}/scans`}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            >
              View scan progress
            </Link>
            <Link
              href={`/businesses/${businessId}/growth-audit`}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            >
              Growth Audit
            </Link>
            <Link
              href={`/businesses/${businessId}/reports?type=single_scan`}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            >
              Create prospect report
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
