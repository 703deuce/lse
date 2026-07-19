"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextBestAction } from "@/lib/journey/next-best-actions";

export function NextBestActionsPanel({
  title = "Suggested next actions",
  actions,
  className,
}: {
  title?: string;
  actions: NextBestAction[];
  className?: string;
}) {
  if (!actions.length) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>
      </div>
      <ul className="space-y-2">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              href={action.href}
              className="group flex items-start justify-between gap-3 rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-900">{action.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-emerald-600" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
