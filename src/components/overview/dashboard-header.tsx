"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Play } from "lucide-react";
import { btnPrimary } from "@/components/ui/design-system";
import { dashboardControl } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
    <header className="pb-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
            {`${greeting}, ${userName.trim() || "there"}`}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
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

          <Link
            href={`/businesses/${businessId}/scans`}
            className={cn(btnPrimary, "h-8 w-full justify-center px-3 text-[13px] sm:w-auto")}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Run Quick Scan
          </Link>
        </div>
      </div>
    </header>
  );
}
