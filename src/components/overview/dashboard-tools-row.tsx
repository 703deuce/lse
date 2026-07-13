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
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      href: `/businesses/${businessId}/backlink-gap`,
      label: "Backlink Gap",
      icon: Link2,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      href: `/businesses/${businessId}/keywords`,
      label: "Keywords",
      icon: KeyRound,
      iconClass: "bg-violet-50 text-violet-600",
    },
    {
      href: `/businesses/${businessId}/review-requests`,
      label: "Review Requests",
      icon: MessageSquarePlus,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      href: `/businesses/${businessId}/trust`,
      label: "Local Trust",
      icon: Award,
      iconClass: "bg-orange-50 text-orange-600",
    },
    {
      href: `/businesses/${businessId}/reports`,
      label: "Reports",
      icon: FileText,
      iconClass: "bg-zinc-100 text-zinc-600",
    },
    {
      href: `/businesses/${businessId}/settings`,
      label: "Settings",
      icon: Settings,
      iconClass: "bg-zinc-100 text-zinc-600",
    },
  ];

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tools</h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {tools.map((tool) => (
          <Link
            key={tool.label}
            href={tool.href}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-lg border border-transparent px-2 py-2.5",
              "transition hover:border-zinc-200 hover:bg-white hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                tool.iconClass
              )}
            >
              <tool.icon className="h-4 w-4" />
            </span>
            <span className="text-center text-[11px] font-medium leading-tight text-zinc-600 group-hover:text-zinc-900">
              {tool.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
