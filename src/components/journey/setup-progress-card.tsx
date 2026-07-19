"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { SetupProgress } from "@/lib/journey/next-best-actions";
import { cn } from "@/lib/utils";

export function SetupProgressCard({ progress }: { progress: SetupProgress }) {
  if (progress.complete) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-[13px] font-semibold text-zinc-900">Complete your setup</h2>
      <p className="mt-0.5 text-[12px] text-zinc-500">
        Finish these steps so you can deliver your first client report.
      </p>
      <ol className="mt-3 space-y-2">
        {progress.steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition",
                step.done
                  ? "text-zinc-500"
                  : "text-zinc-900 hover:bg-zinc-50"
              )}
            >
              {step.done ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
              )}
              <span className={step.done ? "line-through" : "font-medium"}>
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
