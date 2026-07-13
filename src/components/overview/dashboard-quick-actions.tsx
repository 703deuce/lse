import Link from "next/link";
import { Building2, ChevronRight, Megaphone, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const cardClass =
  "group flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-zinc-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]";

export function DashboardQuickActions({ businessId }: { businessId: string }) {
  const actions = [
    {
      href: `/businesses/${businessId}/scans`,
      title: "Run Quick Scan",
      description: "Run a single scan to check local rankings fast.",
      icon: Play,
      iconWrap: "bg-emerald-50 text-emerald-600",
    },
    {
      href: "/businesses/new",
      title: "Add a Location",
      description: "Add another business location to your account.",
      icon: Building2,
      iconWrap: "bg-blue-50 text-blue-600",
    },
    {
      href: `/businesses/${businessId}/review-requests`,
      title: "Create Campaign",
      description: "Launch a review request campaign for customers.",
      icon: Megaphone,
      iconWrap: "bg-violet-50 text-violet-600",
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {actions.map((action) => (
        <Link key={action.title} href={action.href} className={cardClass}>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              action.iconWrap
            )}
          >
            <action.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">{action.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-zinc-500">{action.description}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-500" />
        </Link>
      ))}
    </div>
  );
}
