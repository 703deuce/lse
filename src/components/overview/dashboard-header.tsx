"use client";

import Link from "next/link";
import { Calendar, ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateRange(): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function DashboardHeader({
  userName,
  businessName,
  businessId,
}: {
  userName: string;
  businessName: string;
  businessId: string;
}) {
  const greeting = greetingForHour(new Date().getHours());

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {greeting}, {userName}! <span aria-hidden>👋</span>
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Here&apos;s what&apos;s happening with {businessName}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2",
            "text-sm text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          )}
        >
          <Calendar className="h-4 w-4 text-zinc-400" />
          {formatDateRange()}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>
        <Link
          href={`/businesses/${businessId}/scans`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Play className="h-4 w-4 fill-current" />
          Run Quick Scan
        </Link>
      </div>
    </header>
  );
}
