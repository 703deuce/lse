"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

export function JourneyBreadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("mb-3 flex flex-wrap items-center gap-1 text-[12px] text-zinc-500", className)}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3 w-3 text-zinc-300" /> : null}
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-zinc-800 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-zinc-800" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
