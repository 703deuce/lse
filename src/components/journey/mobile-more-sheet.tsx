"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useDashboardUI } from "@/components/dashboard/dashboard-context";
import {
  buildUnifiedSidebarNav,
  isSidebarHrefActive,
} from "@/components/dashboard/dashboard-nav";
import { cn } from "@/lib/utils";

function businessIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/businesses\/([^/]+)/);
  if (m?.[1] && m[1] !== "new") return m[1];
  const c = pathname.match(/\/clients\/([^/]+)/);
  if (c?.[1]) return c[1];
  const p = pathname.match(/\/prospects\/([^/]+)/);
  if (p?.[1]) return p[1];
  return null;
}

/**
 * Mobile More menu — same unified tool list as desktop sidebar.
 */
export function MobileMoreSheet() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useDashboardUI();
  const businessId = businessIdFromPath(pathname);
  const nav = buildUnifiedSidebarNav(businessId);

  if (!mobileNavOpen) return null;

  const close = () => setMobileNavOpen(false);

  const sections = [
    { title: null as string | null, items: [nav.getStarted] },
    { title: nav.work.title, items: nav.work.items },
    ...(nav.thisLocation
      ? [
          {
            title: businessId ? "This location" : nav.thisLocation.title,
            items: nav.thisLocation.items,
          },
        ]
      : []),
    { title: nav.growthTools.title, items: nav.growthTools.items },
    {
      title: "Reputation",
      items: [nav.reputation.overview, ...nav.reputation.groups.flatMap((g) => g.items)],
    },
    { title: nav.deliverables.title, items: nav.deliverables.items },
    { title: nav.account.title, items: nav.account.items },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40"
        aria-label="Close menu"
        onClick={close}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Menu</p>
            <p className="text-[11px] text-zinc-500">
              Same tools everywhere — pick a location when a tool needs one.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-3">
          {sections.map((section) => (
            <div key={section.title ?? "get-started"}>
              {section.title ? (
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {section.title}
                </p>
              ) : null}
              <ul className="grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isSidebarHrefActive(pathname, item.href, businessId, {
                    isRankGrid: item.isRankGrid,
                    exact: Boolean(item.children?.length),
                  });
                  return (
                    <li key={`${item.label}-${item.href}`}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-white px-3 py-3 text-[13px] font-medium shadow-sm",
                          active
                            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                            : "text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                            active
                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                              : "bg-emerald-50 text-emerald-600 ring-emerald-100"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 truncate">
                          {item.badge ? `${item.label} · ${item.badge}` : item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
