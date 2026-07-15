import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  FileSearch,
  FileText,
  KeyRound,
  Link2,
  MessageSquarePlus,
  Settings,
} from "lucide-react";
import {
  dashboardCard,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type ToolItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconClass: string;
};

export function DashboardToolsRow({ businessId }: { businessId: string }) {
  const tools: ToolItem[] = [
    {
      href: `/businesses/${businessId}/growth-audit`,
      label: "Growth Audit",
      icon: FileSearch,
      iconClass: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
    },
    {
      href: `/businesses/${businessId}/backlink-gap`,
      label: "Backlink Gap",
      icon: Link2,
      iconClass: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
    },
    {
      href: `/businesses/${businessId}/keywords`,
      label: "Keywords",
      icon: KeyRound,
      iconClass: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
    },
    {
      href: `/businesses/${businessId}/review-requests`,
      label: "Review Requests",
      icon: MessageSquarePlus,
      iconClass: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
    },
    {
      href: `/businesses/${businessId}/trust`,
      label: "Local Trust",
      icon: Award,
      iconClass: "bg-orange-50 text-orange-600 ring-1 ring-orange-100",
    },
    {
      href: `/businesses/${businessId}/reports`,
      label: "Reports",
      icon: FileText,
      iconClass: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
    },
    {
      href: `/businesses/${businessId}/settings`,
      label: "Settings",
      icon: Settings,
      iconClass: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
    },
  ];

  return (
    <section className={cn(dashboardCard, "px-3.5 py-3")}>
      <h2 className={cn(dashboardSectionLabel, "mb-2.5")}>Tools</h2>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-7">
        {tools.map((tool) => (
          <Link
            key={tool.label}
            href={tool.href}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-lg px-1.5 py-2",
              "transition-colors hover:bg-zinc-50"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                tool.iconClass
              )}
            >
              <tool.icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-center text-[10px] font-medium leading-tight text-zinc-500 group-hover:text-zinc-800">
              {tool.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
