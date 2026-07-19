"use client";

import Link from "next/link";
import { Check, Circle, ListChecks } from "lucide-react";
import type { SetupProgress } from "@/lib/journey/next-best-actions";
import {
  ContentCard,
  sectionTitleClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export function SetupProgressCard({ progress }: { progress: SetupProgress }) {
  if (progress.complete) return null;

  const doneCount = progress.steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / Math.max(progress.steps.length, 1)) * 100);

  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={sectionTitleClass}>Complete your setup</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Finish these steps so you can deliver your first client report.
          </p>
        </div>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
          {doneCount}/{progress.steps.length}
        </span>
      </div>

      <div className="px-3.5 pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="divide-y divide-zinc-100 px-2 py-1">
        {progress.steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-1.5 py-2.5 text-[13px] transition",
                step.done ? "text-zinc-500" : "text-zinc-900 hover:bg-zinc-50"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  step.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                )}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className={step.done ? "line-through" : "font-medium"}>{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </ContentCard>
  );
}
