"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, MapPin, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardUIProvider, useDashboardUI } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

function extractBusinessId(pathname: string): string | undefined {
  const match = pathname.match(/^\/businesses\/([^/]+)/);
  return match?.[1];
}

/** Rank grid map view — full-bleed main, no page padding. */
function isFullBleedRoute(pathname: string): boolean {
  return /\/businesses\/[^/]+\/grid\/[^/]+$/.test(pathname) && !pathname.endsWith("/debug");
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const businessId = extractBusinessId(pathname);
  const { compareActive, mobileNavOpen, setMobileNavOpen } = useDashboardUI();
  const fullBleed = isFullBleedRoute(pathname);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-surface-muted">
      {/* Desktop sidebar — unchanged */}
      <DashboardSidebar
        businessId={businessId}
        compareActive={compareActive}
        className="hidden lg:flex"
      />

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/45"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex max-w-[min(18rem,88vw)] shadow-2xl">
            <DashboardSidebar
              businessId={businessId}
              compareActive={compareActive}
              className="flex h-full max-h-dvh"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2.5 border-b border-zinc-200 bg-white/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm"
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600">
              <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-zinc-900">Maps Growth Agent</p>
              <p className="truncate text-[10px] text-zinc-500">Menu</p>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-x-hidden",
            fullBleed ? "overflow-y-hidden p-0" : "overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardUIProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </DashboardUIProvider>
  );
}
