"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [mapsActivated, setMapsActivated] = useState(false);
  const [phase, setPhase] = useState<
    "needs_onboarding" | "reputation_ready" | "maps_activated" | null
  >(null);

  useEffect(() => {
    if (!businessId) {
      setMapsActivated(false);
      setPhase(null);
      return;
    }
    void fetch(`/api/workflow/lifecycle?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const state = json?.state as
          | {
              phase?: "needs_onboarding" | "reputation_ready" | "maps_activated";
              hasMapsScan?: boolean;
            }
          | undefined;
        if (!state) return;
        setPhase(state.phase ?? null);
        setMapsActivated(Boolean(state.hasMapsScan) || state.phase === "maps_activated");
      })
      .catch(() => undefined);
  }, [businessId]);

  const nav = buildUnifiedSidebarNav(businessId, { mapsActivated, phase });

  if (!mobileNavOpen) return null;

  const close = () => setMobileNavOpen(false);

  const sections = [
    ...(nav.getStarted
      ? [{ title: null as string | null, items: [nav.getStarted] }]
      : []),
    ...(nav.overview
      ? [{ title: null as string | null, items: [nav.overview] }]
      : []),
    { title: nav.work.title, items: nav.work.items },
    { title: nav.reputation.title, items: nav.reputation.items },
    { title: nav.growReviews.title, items: nav.growReviews.items },
    { title: nav.localVisibility.title, items: nav.localVisibility.items },
    { title: nav.growthTools.title, items: nav.growthTools.items },
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

        <div className="space-y-4 px-3 py-4">
          {sections.map((section, idx) => (
            <div key={`${section.title ?? "top"}-${idx}`}>
              {section.title ? (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {section.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isSidebarHrefActive(pathname, item.href, businessId, {
                    isRankGrid: item.isRankGrid,
                  });
                  return (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium",
                        active
                          ? "bg-[#ECFDF3] text-[#137752]"
                          : "text-zinc-800 hover:bg-zinc-50"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
