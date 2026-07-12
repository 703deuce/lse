"use client";

import { usePathname } from "next/navigation";
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
  const { compareActive } = useDashboardUI();
  const fullBleed = isFullBleedRoute(pathname);

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <DashboardSidebar businessId={businessId} compareActive={compareActive} />
      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          fullBleed ? "overflow-hidden p-0" : "overflow-y-auto px-5 py-6 lg:px-8"
        )}
      >
        {children}
      </main>
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
