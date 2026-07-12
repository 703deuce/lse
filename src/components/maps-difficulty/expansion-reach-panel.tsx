"use client";

import { Navigation, Info } from "lucide-react";
import type { ExpansionReachResult } from "@/lib/maps-difficulty/expansion-reach";

function expansionLabelColor(label: string): { bg: string; text: string; ring: string } {
  switch (label) {
    case "Easy Expansion":
      return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500" };
    case "Possible but Competitive":
      return { bg: "bg-lime-50 dark:bg-lime-900/20", text: "text-lime-700 dark:text-lime-300", ring: "ring-lime-500" };
    case "Hard Expansion":
      return { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-500" };
    case "Very Hard Expansion":
      return { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", ring: "ring-red-500" };
    default:
      return { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-600" };
  }
}

function reachLabelColor(label: string): string {
  if (label.includes("Inside")) return "text-primary dark:text-emerald-400";
  if (label.includes("Near")) return "text-lime-600 dark:text-lime-400";
  if (label.includes("Outside") && !label.includes("Far") && !label.includes("Likely")) return "text-amber-600 dark:text-amber-400";
  if (label.includes("Far")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function ExpansionReachPanel({
  expansion,
  mkdScore,
  mkdLabel,
}: {
  expansion: ExpansionReachResult;
  mkdScore: number;
  mkdLabel: string;
}) {
  const colors = expansionLabelColor(expansion.expansionDifficultyLabel);

  return (
    <div className="space-y-4">
      {/* dual score header */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-subtle p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Maps Keyword Difficulty</p>
          <p className="mt-1 text-2xl font-black text-text dark:text-zinc-100">{mkdScore} <span className="text-sm font-medium text-text-muted">/ 100</span></p>
          <p className="text-sm text-text-muted dark:text-text-muted">{mkdLabel} — market difficulty</p>
        </div>
        <div className={`rounded-2xl border border-border p-5 dark:border-zinc-800 ${colors.bg}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Expansion Reach Difficulty</p>
          <p className={`mt-1 text-2xl font-black ${colors.text}`}>
            {expansion.expansionDifficultyScore} <span className="text-sm font-medium text-text-muted">/ 100</span>
          </p>
          <p className={`text-sm font-medium ${colors.text}`}>{expansion.expansionDifficultyLabel}</p>
          <p className="mt-1 text-xs text-text-muted">+{expansion.reachPenalty} proximity penalty on top of market score</p>
          <p className="mt-2 text-xs text-text-muted">
            Expansion Reach does not replace Maps Keyword Difficulty. It adds your base-location proximity disadvantage to
            the market difficulty score.
          </p>
        </div>
      </div>

      {/* distance comparison */}
      <div className="rounded-2xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-sky-600" />
          <h3 className="text-sm font-semibold text-text dark:text-zinc-50">Distance comparison</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-sky-50 p-4 dark:bg-sky-900/20">
            <p className="text-xs font-medium uppercase text-text-muted">Your business base</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
              {expansion.businessDistanceToSearchPin} mi
            </p>
            <p className="mt-1 text-xs text-text-muted">{expansion.businessBaseLabel || expansion.businessBaseInput}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle p-4 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-text-muted">Current top-3 range</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text dark:text-zinc-200">
              {expansion.top3MinDistance}–{expansion.top3MaxDistance} mi
            </p>
            <p className="mt-1 text-xs text-text-muted">Median {expansion.top3MedianDistance} mi</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Pack tightness" value={expansion.packTightness} />
          <Stat label="Reach label" value={expansion.reachLabel} valueClass={reachLabelColor(expansion.reachLabel)} />
          <Stat
            label="Distance ratio"
            value={expansion.distanceRatio != null ? `${expansion.distanceRatio}x farthest incumbent` : "N/A"}
          />
        </div>

        <p className="mt-4 text-sm text-text-muted dark:text-text-muted">{expansion.message}</p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{expansion.explanation}</span>
        </p>
      </div>

      {/* competitor distances */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-border px-6 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top 3 distances from search pin</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-text-muted">
              <th className="px-6 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 text-right font-medium">Distance</th>
            </tr>
          </thead>
          <tbody>
            {expansion.top3CompetitorDistances.map((c) => (
              <tr key={c.rank} className="border-t border-border dark:border-zinc-800">
                <td className="px-6 py-3 font-semibold text-text-muted">{c.rank}</td>
                <td className="px-3 py-3 font-medium text-text dark:text-zinc-50">{c.name}</td>
                <td className="px-3 py-3 text-right tabular-nums text-text-muted dark:text-text-muted">{c.distanceMi} mi</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 dark:border-zinc-800">
      <p className="text-[11px] font-medium uppercase text-text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${valueClass ?? "text-text dark:text-zinc-200"}`}>{value}</p>
    </div>
  );
}
