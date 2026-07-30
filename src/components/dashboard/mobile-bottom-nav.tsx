"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, MapPin, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardUI } from "@/components/dashboard/dashboard-context";
import { isAgencyOrganizationPlan } from "@/lib/product/organization";
import type { SuiteId } from "@/lib/dashboard/suite-navigation";

const SUITE_TABS: {
  id: SuiteId;
  label: string;
  icon: typeof MapPin;
  match: (p: string) => boolean;
}[] = [
  {
    id: "local-seo",
    label: "Local SEO",
    icon: MapPin,
    match: (p) =>
      p.includes("/scans") ||
      p.includes("/grid/") ||
      p.includes("/growth-audit") ||
      p.includes("/backlink-gap") ||
      p.includes("/trust") ||
      p.includes("/ai-visibility") ||
      p.includes("/local-seo-health") ||
      p.includes("/tasks") ||
      (p.includes("/overview") && !p.includes("/reputation/")) ||
      p.includes("/campaigns") ||
      p.includes("/keywords"),
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: Star,
    match: (p) =>
      p.includes("/reputation/") ||
      p.includes("/messaging") ||
      p.includes("/automations") ||
      p.includes("/alerts") ||
      p.includes("/tools/review-") ||
      p.includes("/tools/google-review-widget"),
  },
  {
    id: "agency",
    label: "Agency",
    icon: Building2,
    match: (p) =>
      p === "/workspace" ||
      p.startsWith("/workspace") ||
      p.startsWith("/prospects") ||
      p.startsWith("/clients") ||
      p === "/businesses",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p.startsWith("/settings") || p.startsWith("/onboarding") || p.startsWith("/branding"),
  },
];

/** Mobile bottom nav — product suites + More (opens accordion menu sheet). */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { setMobileNavOpen } = useDashboardUI();
  const [showAgency, setShowAgency] = useState(false);

  useEffect(() => {
    void fetch("/api/account/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.organization) {
          setShowAgency(isAgencyOrganizationPlan(json.organization.plan));
        }
      })
      .catch(() => undefined);
  }, []);

  if (/\/businesses\/[^/]+\/grid\/[^/]+$/.test(pathname) && !pathname.endsWith("/debug")) {
    return null;
  }

  const tabs = SUITE_TABS.filter((t) => t.id !== "agency" || showAgency);
  const colCount = tabs.length + 1;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Product suites"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                  active ? "text-emerald-700" : "text-zinc-500"
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-emerald-600" : "text-zinc-400")} />
                <span className="max-w-full truncate">{tab.label}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-zinc-500"
          >
            <Settings className="h-5 w-5 text-zinc-400" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
