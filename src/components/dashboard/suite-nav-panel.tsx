"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ChevronDown, Lock } from "lucide-react";
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

function sectionKey(suiteId: SuiteId, sectionId: string) {
  return `${suiteId}:${sectionId}`;
}

function NavLinkRow({
  href,
  label,
  icon: Icon,
  active,
  locked,
  onNavigate,
  nested,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  locked?: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const className = cn(
    "relative flex items-center gap-2 rounded-lg py-1.5 text-[12px] font-medium transition-colors",
    nested ? "pl-9 pr-3" : "px-3 py-2 text-[13px]",
    locked
      ? "text-slate-500 hover:bg-white/5 hover:text-slate-300"
      : active
        ? nested
          ? "text-emerald-300"
          : "bg-[#137752] text-white"
        : nested
          ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
  );

  return (
    <Link
      href={href}
      className={className}
      title={locked ? "Upgrade to unlock" : undefined}
      onClick={() => onNavigate?.()}
    >
      {!nested ? (
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            locked ? "text-slate-500" : active ? "text-white" : "text-slate-400"
          )}
        />
      ) : (
        active && (
          <span className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400" />
        )
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden /> : null}
    </Link>
  );
}

function SectionAccordion({
  section,
  businessId,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  section: SuiteNavSection;
  businessId?: string | null;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const isLinkActive = (link: SuiteNavLink) =>
    !link.locked &&
    isSidebarHrefActive(pathname, link.href, businessId, { isRankGrid: link.isRankGrid });

  const sectionActive = section.items.some((link) => isLinkActive(link));

  if (section.items.length === 1) {
    const link = section.items[0]!;
    return (
      <NavLinkRow
        href={link.href}
        label={section.label}
        icon={link.icon}
        active={isLinkActive(link)}
        locked={link.locked}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
          sectionActive ? "text-emerald-300" : "text-slate-300 hover:bg-white/5 hover:text-white"
        )}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 pb-1">
          {section.items.map((link) => (
            <NavLinkRow
              key={`${link.label}-${link.href}`}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={isLinkActive(link)}
              locked={link.locked}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SuiteAccordion({
  suite,
  businessId,
  pathname,
  open,
  onToggle,
  openSections,
  toggleSection,
  onNavigate,
}: {
  suite: AppSuite;
  businessId?: string | null;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  openSections: Set<string>;
  toggleSection: (key: string) => void;
  onNavigate?: () => void;
}) {
  const suiteActive = useMemo(() => {
    const ctx = resolveSuiteNavContext(pathname, [suite], businessId);
    return ctx?.suiteId === suite.id;
  }, [suite, pathname, businessId]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors",
          suiteActive ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5"
        )}
        aria-expanded={open}
      >
        <suite.icon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{suite.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-1 ml-2 space-y-0.5 border-l border-white/10 pl-2">
          {suite.sections.map((section) => (
            <SectionAccordion
              key={section.id}
              section={section}
              businessId={businessId}
              pathname={pathname}
              open={openSections.has(sectionKey(suite.id, section.id))}
              onToggle={() => toggleSection(sectionKey(suite.id, section.id))}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
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

  const [openSuites, setOpenSuites] = useState<Set<SuiteId>>(() =>
    resolved ? new Set([resolved.suiteId]) : new Set()
  );
  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    resolved ? new Set([sectionKey(resolved.suiteId, resolved.sectionId)]) : new Set()
  );

  useEffect(() => {
    if (!resolved) return;
    setOpenSuites((prev) => new Set(prev).add(resolved.suiteId));
    setOpenSections((prev) => new Set(prev).add(sectionKey(resolved.suiteId, resolved.sectionId)));
  }, [pathname, resolved?.suiteId, resolved?.sectionId]);

  const toggleSuite = (id: SuiteId) => {
    setOpenSuites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {suites.map((suite) => (
        <SuiteAccordion
          key={suite.id}
          suite={suite}
          businessId={businessId}
          pathname={pathname}
          open={openSuites.has(suite.id)}
          onToggle={() => toggleSuite(suite.id)}
          openSections={openSections}
          toggleSection={toggleSection}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export function useAppSuites(businessId?: string | null, trial = false, showAgencySuite = false) {
  return useMemo(
    () => buildAppSuites(businessId, { trial, showAgencySuite }),
    [businessId, trial, showAgencySuite]
  );
}
