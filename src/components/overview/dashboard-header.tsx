"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Calendar, ChevronDown, Play } from "lucide-react";
import { pageSubtitleClass, pageTitleClass, btnPrimary } from "@/components/ui/design-system";
import {
  dashboardControl,
} from "@/components/overview/dashboard-ui";
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
  businessId,
  businessName,
  businesses,
}: {
  userName: string;
  businessId: string;
  businessName: string;
  businesses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const greeting = greetingForHour(new Date().getHours());

  return (
    <header className="border-b border-zinc-200/70 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={cn(pageTitleClass, "text-[1.35rem] font-semibold")}>
            {greeting}, {userName}
          </h1>
          <p className={cn(pageSubtitleClass, "mt-1 text-[13px] text-zinc-500")}>
            Performance snapshot for{" "}
            <span className="font-medium text-zinc-700">{businessName}</span>
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative w-full min-w-0 sm:min-w-[11.5rem] sm:max-w-[16rem]">
            <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <select
              value={businessId}
              onChange={(e) => router.push(`/businesses/${e.target.value}/overview`)}
              className={cn(
                dashboardControl,
                "w-full appearance-none py-0 pl-8 pr-8 font-medium"
              )}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          </label>

          <button
            type="button"
            className={cn(
              dashboardControl,
              "inline-flex w-full items-center justify-between gap-2 px-3 font-medium text-zinc-600 sm:w-auto"
            )}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="truncate whitespace-nowrap">{formatDateRange()}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </button>

          <Link
            href={`/businesses/${businessId}/scans`}
            className={cn(btnPrimary, "h-9 w-full justify-center px-3.5 text-[13px] sm:w-auto")}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Run Quick Scan
          </Link>
        </div>
      </div>
    </header>
  );
}
