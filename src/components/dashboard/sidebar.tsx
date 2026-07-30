"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import { isAgencyOrganizationPlan } from "@/lib/product/organization";
import { SidebarUserMenu } from "@/components/auth/sidebar-user-menu";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { SuiteNavigationList, useAppSuites } from "@/components/dashboard/suite-nav-panel";

export function DashboardSidebarPanel({
  businessId,
  pathname,
  businessName,
  staticLinks = false,
  showFooter = true,
  trial = false,
  showAgencySuite = false,
  className,
  onNavigate,
}: {
  businessId?: string;
  pathname: string;
  businessName?: string | null;
  staticLinks?: boolean;
  showFooter?: boolean;
  trial?: boolean;
  showAgencySuite?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const suites = useAppSuites(businessId, trial, showAgencySuite);

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className ?? "flex"
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          {staticLinks ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#137752]">
                <MapPin className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">Local SEO Express</p>
                <p className="text-[11px] text-slate-400">Reviews &amp; local rankings</p>
              </div>
            </div>
          ) : (
            <Link
              href={businessId ? `/businesses/${businessId}/overview` : "/onboarding"}
              className="flex min-w-0 items-center gap-2.5"
              onClick={() => onNavigate?.()}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#137752]">
                <MapPin className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">Local SEO Express</p>
                <p className="text-[11px] text-slate-400">Reviews &amp; local rankings</p>
              </div>
            </Link>
          )}
        </div>
        {staticLinks ? (
          <div className="mx-1 mt-2.5 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">
              {businessName ?? "Select your business…"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
        ) : (
          <BusinessSwitcher
            businessId={businessId}
            businessName={businessName}
            onNavigate={onNavigate}
          />
        )}
      </div>

      <nav
        className="flex-1 overflow-y-auto overscroll-contain p-2.5"
        suppressHydrationWarning
        aria-label="App navigation"
      >
        <SuiteNavigationList
          suites={suites}
          businessId={businessId}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>

      {showFooter && !staticLinks && (
        <div className="space-y-2 border-t border-sidebar-border p-2.5">
          <SidebarUserMenu />
        </div>
      )}
    </aside>
  );
}

export function DashboardSidebar({
  businessId,
  className,
  onNavigate,
}: {
  businessId?: string;
  compareActive?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Suspense fallback={<SidebarFallback className={className} />}>
      <DashboardSidebarInner
        businessId={businessId}
        className={className}
        onNavigate={onNavigate}
      />
    </Suspense>
  );
}

function SidebarFallback({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className ?? "flex"
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <p className="text-sm font-bold text-white">Local SEO Express</p>
      </div>
      <div className="flex-1 p-2.5" />
    </aside>
  );
}

function DashboardSidebarInner({
  businessId,
  className,
  onNavigate,
}: {
  businessId?: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [trial, setTrial] = useState(true);
  const [showAgencySuite, setShowAgencySuite] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setBusinessName(null);
      return;
    }
    void fetch(`/api/businesses/${businessId}/account`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.account?.name) setBusinessName(json.account.name as string);
      })
      .catch(() => undefined);
  }, [businessId]);

  useEffect(() => {
    void fetch("/api/account/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.organization) {
          setTrial(
            organizationLooksLikeTrial({
              plan: json.organization.plan,
              billing_status: json.organization.billing_status,
            })
          );
          setShowAgencySuite(isAgencyOrganizationPlan(json.organization.plan));
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <DashboardSidebarPanel
      businessId={businessId}
      pathname={pathname}
      businessName={businessName}
      trial={trial}
      showAgencySuite={showAgencySuite}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
