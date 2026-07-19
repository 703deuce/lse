"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const STEPS = [
  "Name",
  "Keywords",
  "Grid defaults",
  "Schedule",
  "Baseline",
] as const;

export function CampaignSetupWizard({
  businessId,
  onClose,
}: {
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Monthly Maps tracking");
  const [keywordsText, setKeywordsText] = useState("");
  const [gridSize, setGridSize] = useState(5);
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [scheduleType, setScheduleType] = useState<"manual" | "weekly" | "biweekly" | "monthly">(
    "monthly"
  );
  const [runBaseline, setRunBaseline] = useState(true);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          defaultGridSize: gridSize,
          defaultRadiusMeters: radiusMeters,
          scheduleType,
          scheduleEnabled: scheduleType !== "manual",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      const campaignId = json.campaign?.id as string;
      setCreatedId(campaignId);

      const keywords = keywordsText
        .split(/[\n,]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 20);

      const keywordIds: string[] = [];
      for (const keyword of keywords) {
        const addRes = await fetch("/api/scans/keywords/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, keyword, campaignId }),
        });
        const addJson = await addRes.json().catch(() => ({}));
        if (addRes.ok && addJson.keyword?.id) {
          keywordIds.push(addJson.keyword.id as string);
        }
      }

      if (runBaseline && keywordIds.length) {
        for (const keywordId of keywordIds) {
          await fetch("/api/scans/run-for-keyword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              keywordId,
              gridSize,
              radiusMeters,
            }),
          }).catch(() => null);
        }
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Campaign setup</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Create → baseline → recurring scans → compare → report.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="mb-4 flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              i === step
                ? "bg-emerald-600 text-white"
                : i < step
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-zinc-100 text-zinc-500"
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {step === 0 ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Campaign name</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : null}

      {step === 1 ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Keywords (one per line)</span>
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder={"plumber near me\nemergency plumber\nplumber austin"}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            You can add more later from Keywords or this campaign page.
          </p>
        </label>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Grid size</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
            >
              {[3, 5, 7, 9].map((n) => (
                <option key={n} value={n}>
                  {n}×{n}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Radius (meters)</span>
            <input
              type="number"
              min={500}
              max={20000}
              step={500}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
            />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Schedule</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            value={scheduleType}
            onChange={(e) =>
              setScheduleType(e.target.value as "manual" | "weekly" | "biweekly" | "monthly")
            }
          >
            <option value="manual">Manual only</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Recurring scans feed the monthly report workflow.
          </p>
        </label>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={runBaseline}
              onChange={(e) => setRunBaseline(e.target.checked)}
            />
            <span>
              <span className="font-medium text-zinc-900">Run baseline scans</span>
              <span className="mt-0.5 block text-[12px] text-zinc-500">
                Establish starting ranks for each keyword so next month has a comparison.
              </span>
            </span>
          </label>
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
            <p>
              <strong>{name}</strong> · {gridSize}×{gridSize} · {radiusMeters}m · {scheduleType}
            </p>
            <p className="mt-1">
              Keywords:{" "}
              {keywordsText
                .split(/[\n,]/)
                .map((k) => k.trim())
                .filter(Boolean).length || "none yet"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
          onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          disabled={busy}
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            disabled={!name.trim()}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            disabled={busy || !name.trim()}
            onClick={() => void finish()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {createdId ? "Opening…" : "Create campaign"}
          </button>
        )}
      </div>
    </div>
  );
}
