"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useDashboardUI } from "@/components/dashboard/dashboard-context";
import { SuiteNavigationList, useAppSuites } from "@/components/dashboard/suite-nav-panel";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import { isAgencyOrganizationPlan } from "@/lib/product/organization";

function businessIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/businesses\/([^/]+)/);
  if (m?.[1] && m[1] !== "new") return m[1];
  const c = pathname.match(/\/clients\/([^/]+)/);
  if (c?.[1]) return c[1];
  const p = pathname.match(/\/prospects\/([^/]+)/);
  if (p?.[1]) return p[1];
  return null;
}

/** Mobile More menu — suite drill-down navigation (same as desktop sidebar). */
export function MobileMoreSheet() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useDashboardUI();
  const businessId = businessIdFromPath(pathname);
  const [trial, setTrial] = useState(true);
  const [showAgencySuite, setShowAgencySuite] = useState(false);
  const suites = useAppSuites(businessId, trial, showAgencySuite);

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

  if (!mobileNavOpen) return null;

  const close = () => setMobileNavOpen(false);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40"
        aria-label="Close menu"
        onClick={close}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-sidebar pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-sidebar px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Menu</p>
            <p className="text-[11px] text-slate-400">Choose a suite, then a section.</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <SuiteNavigationList
            suites={suites}
            businessId={businessId}
            pathname={pathname}
            onNavigate={close}
          />
        </div>
      </div>
    </div>
  );
}
