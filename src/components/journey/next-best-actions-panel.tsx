"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextBestAction } from "@/lib/journey/next-best-actions";
import { ContentCard, sectionTitleClass } from "@/components/ui/design-system";

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
    <ContentCard
      padding={false}
      className={cn(
        "overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white",
        className
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-emerald-100/80 px-3.5 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className={sectionTitleClass}>{title}</h2>
      </div>
      <ul className="divide-y divide-emerald-100/60">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              href={action.href}
              className="group flex items-start justify-between gap-3 px-3.5 py-2.5 transition hover:bg-emerald-50/50"
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
    </ContentCard>
  );
}
