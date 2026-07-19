import Link from "next/link";
import { Building2, ChevronRight, FileText, Play, Target } from "lucide-react";
import { dashboardBody, dashboardCard, dashboardCardTitle } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export function DashboardQuickActions({ businessId }: { businessId: string }) {
  const actions = [
    {
      href: `/businesses/${businessId}/scans`,
      title: "Run scan",
      description: "Queue a Maps grid in the background.",
      icon: Play,
      iconWrap: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
    },
    {
      href: `/businesses/${businessId}/reports`,
      title: "Create report",
      description: "Turn completed scans into a branded deliverable.",
      icon: FileText,
      iconWrap: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
    },
    {
      href: "/businesses/new?as=prospect",
      title: "New prospect",
      description: "Start an audit for outreach.",
      icon: Target,
      iconWrap: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    },
    {
      href: "/businesses/new?as=client",
      title: "New client",
      description: "Add a client location to track.",
      icon: Building2,
      iconWrap: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
    },
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.title}
          href={action.href}
          className={cn(
            dashboardCard,
            "group flex items-center gap-3 p-3 transition-colors hover:border-zinc-300/80 hover:bg-zinc-50/40"
          )}
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              action.iconWrap
            )}
          >
            <action.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={dashboardCardTitle}>{action.title}</p>
            <p className={cn(dashboardBody, "mt-0.5 text-[12px] text-zinc-500")}>
              {action.description}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition group-hover:text-zinc-500" />
        </Link>
      ))}
    </div>
  );
}
