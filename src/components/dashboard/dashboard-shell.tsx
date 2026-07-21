"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, MapPin, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { MobileMoreSheet } from "@/components/journey/mobile-more-sheet";
import { DashboardUIProvider, useDashboardUI } from "@/components/dashboard/dashboard-context";
import { DesktopTopBar } from "@/components/mockup/desktop-topbar";
import { cn } from "@/lib/utils";

function extractBusinessId(pathname: string): string | undefined {
  const business = pathname.match(/^\/businesses\/([^/]+)/);
  if (business?.[1] && business[1] !== "new") return business[1];
  // Freelancer CRM detail routes use the same business UUID.
  const client = pathname.match(/^\/clients\/([^/]+)/);
  if (client?.[1]) return client[1];
  const prospect = pathname.match(/^\/prospects\/([^/]+)/);
  if (prospect?.[1]) return prospect[1];
  return undefined;
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
    <div className="flex min-h-screen overflow-x-hidden bg-[#F9FAFB]">
      <DashboardSidebar
        businessId={businessId}
        compareActive={compareActive}
        className="hidden lg:flex"
      />

      <MobileMoreSheet />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2.5 border-b border-[#E6EAF0] bg-white/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E6EAF0] bg-white text-[#344054] shadow-sm"
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#137752]">
              <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#101828]">Local SEO Express</p>
              <p className="truncate text-[10px] text-[#667085]">Menu</p>
            </div>
          </div>
        </header>

        {!fullBleed ? <DesktopTopBar /> : null}

        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-x-hidden",
            fullBleed
              ? "overflow-y-hidden p-0"
              : "overflow-y-auto px-4 py-5 pb-20 sm:px-6 sm:py-6 lg:px-8 lg:pb-8"
          )}
        >
          {children}
        </main>
        <MobileBottomNav />
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
