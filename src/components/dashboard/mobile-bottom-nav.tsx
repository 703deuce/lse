"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  FileText,
  Menu,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardUI } from "@/components/dashboard/dashboard-context";

const TABS = [
  {
    href: "/workspace",
    label: "Workspace",
    icon: Briefcase,
    match: (p: string) => p === "/workspace" || p === "/dashboard",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Building2,
    match: (p: string) => p.startsWith("/clients") || p.startsWith("/prospects"),
  },
  {
    href: "/scans",
    label: "Scans",
    icon: Radar,
    match: (p: string) =>
      p.startsWith("/scans") || p.includes("/scans") || p.includes("/grid/"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileText,
    match: (p: string) => p.startsWith("/reports") || p.includes("/reports"),
  },
] as const;

/**
 * Mobile bottom nav (5 items). Full tool tree stays in the More drawer (sidebar).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { setMobileNavOpen } = useDashboardUI();

  // Hide on full-bleed grid map
  if (/\/businesses\/[^/]+\/grid\/[^/]+$/.test(pathname) && !pathname.endsWith("/debug")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                  active ? "text-emerald-700" : "text-zinc-500"
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-emerald-600" : "text-zinc-400")} />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-zinc-500"
          >
            <Menu className="h-5 w-5 text-zinc-400" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
