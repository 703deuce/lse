"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  buildAppSuites,
  resolveSuiteNavContext,
  type AppSuite,
  type SuiteId,
  type SuiteNavLink,
  type SuiteNavSection,
} from "@/lib/dashboard/suite-navigation";
import { isSidebarHrefActive } from "@/components/dashboard/dashboard-nav";

function NavLinkRow({
  href,
  label,
  icon: Icon,
  active,
  locked,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  locked?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        locked
          ? "text-slate-500 hover:bg-white/5 hover:text-slate-300"
          : active
            ? "bg-[#137752] text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
      )}
      title={locked ? "Upgrade to unlock" : undefined}
      onClick={() => onNavigate?.()}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          locked ? "text-slate-500" : active ? "text-white" : "text-slate-400"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden /> : null}
    </Link>
  );
}

function SectionHeading({ label }: { label: string }) {
  if (!label) return null;
  return (
    <p
      className="mb-1 mt-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 first:mt-0"
      role="presentation"
    >
      {label}
    </p>
  );
}

function SuiteFlatNav({
  suite,
  businessId,
  pathname,
  onNavigate,
}: {
  suite: AppSuite;
  businessId?: string | null;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isLinkActive = (link: SuiteNavLink) =>
    !link.locked &&
    !link.signOut &&
    isSidebarHrefActive(pathname, link.href, businessId, { isRankGrid: link.isRankGrid });

  return (
    <div className="space-y-0.5">
      {suite.sections.map((section: SuiteNavSection) => (
        <div key={section.id}>
          <SectionHeading label={section.label} />
          <div className="space-y-0.5">
            {section.items.map((link) =>
              link.signOut ? (
                <LogoutButton
                  key="sign-out"
                  label="Sign Out"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                />
              ) : (
                <NavLinkRow
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  active={isLinkActive(link)}
                  locked={link.locked}
                  onNavigate={onNavigate}
                />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuiteTabBar({
  suites,
  activeId,
  onSelect,
}: {
  suites: AppSuite[];
  activeId: SuiteId;
  onSelect: (id: SuiteId) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Product suites">
      {suites.map((suite) => {
        const active = suite.id === activeId;
        return (
          <button
            key={suite.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(suite.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              active
                ? "bg-[#137752] text-white"
                : "text-slate-400 hover:bg-white/10 hover:text-slate-200"
            )}
          >
            <suite.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{suite.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SuiteNavigationList({
  suites,
  businessId,
  pathname,
  onNavigate,
  className,
}: {
  suites: AppSuite[];
  businessId?: string | null;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const resolved = resolveSuiteNavContext(pathname, suites, businessId);
  const [activeSuiteId, setActiveSuiteId] = useState<SuiteId>(
    resolved?.suiteId ?? suites[0]?.id ?? "local-seo"
  );

  useEffect(() => {
    if (resolved?.suiteId) setActiveSuiteId(resolved.suiteId);
  }, [resolved?.suiteId, pathname]);

  const activeSuite = useMemo(
    () => suites.find((s) => s.id === activeSuiteId) ?? suites[0],
    [suites, activeSuiteId]
  );

  if (!activeSuite) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      <SuiteTabBar suites={suites} activeId={activeSuite.id} onSelect={setActiveSuiteId} />
      <SuiteFlatNav
        suite={activeSuite}
        businessId={businessId}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export function useAppSuites(businessId?: string | null, trial = false, showAgencySuite = false) {
  return useMemo(
    () => buildAppSuites(businessId, { trial, showAgencySuite }),
    [businessId, trial, showAgencySuite]
  );
}
