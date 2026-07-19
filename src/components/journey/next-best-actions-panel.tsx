"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextBestAction } from "@/lib/journey/next-best-actions";
import { ContentCard, sectionTitleClass } from "@/components/ui/design-system";

const DEFAULT_LIMIT = 5;

export function NextBestActionsPanel({
  title = "Suggested next actions",
  actions,
  className,
  limit = DEFAULT_LIMIT,
  viewAllHref,
}: {
  title?: string;
  actions: NextBestAction[];
  className?: string;
  /** Cap visible rows — Workspace should never dump a long list. */
  limit?: number;
  viewAllHref?: string;
}) {
  if (!actions.length) return null;

  const visible = actions.slice(0, limit);
  const remaining = Math.max(0, actions.length - visible.length);

  return (
    <ContentCard
      padding={false}
      className={cn(
        "overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-100/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className={sectionTitleClass}>{title}</h2>
        </div>
        {remaining > 0 && viewAllHref ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-[12px] font-medium text-emerald-700 hover:text-emerald-800"
          >
            View all ({actions.length})
          </Link>
        ) : remaining > 0 ? (
          <span className="text-[11px] text-zinc-400">+{remaining} more</span>
        ) : null}
      </div>
      <ul className="divide-y divide-emerald-100/60">
        {visible.map((action) => (
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
