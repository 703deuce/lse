"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, Lock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildAppSuites,
  resolveSuiteNavContext,
  type AppSuite,
  type SuiteId,
  type SuiteNavLink,
  type SuiteNavSection,
} from "@/lib/dashboard/suite-navigation";
import { isSidebarHrefActive } from "@/components/dashboard/dashboard-nav";

type NavView = "suites" | "sections" | "items";

function NavLinkRow({
  href,
  label,
  icon: Icon,
  active,
  locked,
  onNavigate,
  showChevron,
  onDrill,
}: {
  href?: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  locked?: boolean;
  onNavigate?: () => void;
  showChevron?: boolean;
  onDrill?: () => void;
}) {
  const className = cn(
    "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-left",
    locked
      ? "text-slate-500 hover:bg-white/5 hover:text-slate-300"
      : active
        ? "bg-[#137752] text-white"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
  );

  const inner = (
    <>
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          locked ? "text-slate-500" : active ? "text-white" : "text-slate-400"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden /> : null}
      {showChevron ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      ) : null}
    </>
  );

  if (onDrill) {
    return (
      <button type="button" className={className} onClick={onDrill}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      className={className}
      title={locked ? "Upgrade to unlock" : undefined}
      onClick={() => onNavigate?.()}
    >
      {inner}
    </Link>
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
  const [view, setView] = useState<NavView>("suites");
  const [activeSuiteId, setActiveSuiteId] = useState<SuiteId | null>(resolved?.suiteId ?? null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(resolved?.sectionId ?? null);

  useEffect(() => {
    if (resolved) {
      setActiveSuiteId(resolved.suiteId);
      setActiveSectionId(resolved.sectionId);
      setView("items");
    }
  }, [pathname, resolved?.suiteId, resolved?.sectionId]);

  const activeSuite = useMemo(
    () => suites.find((s) => s.id === activeSuiteId) ?? null,
    [suites, activeSuiteId]
  );

  const activeSection = useMemo(
    () => activeSuite?.sections.find((s) => s.id === activeSectionId) ?? null,
    [activeSuite, activeSectionId]
  );

  const goSuites = useCallback(() => {
    setView("suites");
    setActiveSuiteId(null);
    setActiveSectionId(null);
  }, []);

  const goSections = useCallback(() => {
    setView("sections");
    setActiveSectionId(null);
  }, []);

  const openSuite = useCallback((suite: AppSuite) => {
    setActiveSuiteId(suite.id);
    setView("sections");
  }, []);

  const openSection = useCallback((section: SuiteNavSection) => {
    setActiveSectionId(section.id);
    setView("items");
  }, []);

  const isLinkActive = (link: SuiteNavLink) =>
    !link.locked &&
    isSidebarHrefActive(pathname, link.href, businessId, {
      isRankGrid: link.isRankGrid,
    });

  const backLabel =
    view === "items" ? activeSuite?.label : view === "sections" ? "All suites" : null;

  const onBack =
    view === "items" ? goSections : view === "sections" ? goSuites : undefined;

  return (
    <div className={cn("flex flex-col", className)}>
      {view !== "suites" && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}

      {view === "suites" && (
        <div className="space-y-0.5">
          {suites.map((suite) => (
            <NavLinkRow
              key={suite.id}
              label={suite.label}
              icon={suite.icon}
              showChevron
              onDrill={() => openSuite(suite)}
            />
          ))}
        </div>
      )}

      {view === "sections" && activeSuite && (
        <div className="space-y-0.5">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {activeSuite.label}
          </p>
          {activeSuite.sections.map((section) => (
            <NavLinkRow
              key={section.id}
              label={section.label}
              icon={section.items[0]?.icon ?? MapPin}
              showChevron
              onDrill={() => openSection(section)}
            />
          ))}
        </div>
      )}

      {view === "items" && activeSection && (
        <div className="space-y-0.5">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {activeSection.label}
          </p>
          {activeSection.items.map((link) => (
            <NavLinkRow
              key={`${link.label}-${link.href}`}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={isLinkActive(link)}
              locked={link.locked}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function useAppSuites(businessId?: string | null, trial = false, showAgencySuite = false) {
  return useMemo(
    () => buildAppSuites(businessId, { trial, showAgencySuite }),
    [businessId, trial, showAgencySuite]
  );
}
