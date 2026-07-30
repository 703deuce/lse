"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ChevronDown, Lock } from "lucide-react";
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

function sectionKey(suiteId: SuiteId, sectionId: string) {
  return `${suiteId}:${sectionId}`;
}

function useAccordionLayout() {
  const [layout, setLayout] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setLayout(mq.matches ? "mobile" : "desktop");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return layout;
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
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors",
        nested ? "pl-9 pr-3 py-1.5 text-[12px]" : "px-3",
        locked
          ? "text-slate-500 hover:bg-white/5 hover:text-slate-300"
          : active
            ? nested
              ? "bg-[#137752]/90 text-white"
              : "bg-[#137752] text-white"
            : nested
              ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
      )}
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
      ) : active ? (
        <span className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden /> : null}
    </Link>
  );
}

function SectionAccordion({
  section,
  suiteId,
  businessId,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  section: SuiteNavSection;
  suiteId: SuiteId;
  businessId?: string | null;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const isLinkActive = (link: SuiteNavLink) =>
    !link.locked &&
    !link.signOut &&
    isSidebarHrefActive(pathname, link.href, businessId, { isRankGrid: link.isRankGrid });

  const navigableItems = section.items.filter((l) => !l.signOut);
  const signOutItem = section.items.find((l) => l.signOut);
  const sectionActive = navigableItems.some((link) => isLinkActive(link));

  const isAccordion = section.label && navigableItems.length > 0;

  if (!isAccordion) {
    return (
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
    );
  }

  if (navigableItems.length === 1 && !signOutItem) {
    const link = navigableItems[0]!;
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
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 pb-1">
          {navigableItems.map((link) => (
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
          {signOutItem ? (
            <LogoutButton
              label="Sign Out"
              className="flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-9 pr-3 text-left text-[12px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuiteSectionNav({
  suite,
  businessId,
  pathname,
  openSections,
  toggleSection,
  onNavigate,
}: {
  suite: AppSuite;
  businessId?: string | null;
  pathname: string;
  openSections: Set<string>;
  toggleSection: (key: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {suite.sections.map((section) => (
        <SectionAccordion
          key={section.id}
          section={section}
          suiteId={suite.id}
          businessId={businessId}
          pathname={pathname}
          open={openSections.has(sectionKey(suite.id, section.id))}
          onToggle={() => toggleSection(sectionKey(suite.id, section.id))}
          onNavigate={onNavigate}
        />
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
  forceMobileAccordion,
}: {
  suites: AppSuite[];
  businessId?: string | null;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  /** When true, only one section accordion can be open (mobile menu sheet). */
  forceMobileAccordion?: boolean;
}) {
  const resolved = resolveSuiteNavContext(pathname, suites, businessId);
  const accordionLayout = useAccordionLayout();
  const singleOpen = forceMobileAccordion || accordionLayout === "mobile";
  const maxOpenSections = singleOpen ? 1 : 2;

  const [activeSuiteId, setActiveSuiteId] = useState<SuiteId>(
    resolved?.suiteId ?? suites[0]?.id ?? "local-seo"
  );
  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    resolved ? new Set([sectionKey(resolved.suiteId, resolved.sectionId)]) : new Set()
  );

  useEffect(() => {
    if (resolved?.suiteId) setActiveSuiteId(resolved.suiteId);
  }, [resolved?.suiteId, pathname]);

  useEffect(() => {
    if (!resolved) return;
    const key = sectionKey(resolved.suiteId, resolved.sectionId);
    setOpenSections((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [pathname, resolved?.suiteId, resolved?.sectionId]);

  const toggleSection = (key: string) => {
    const suiteId = key.split(":")[0] as SuiteId;
    const currentKey = resolved ? sectionKey(resolved.suiteId, resolved.sectionId) : null;

    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      const suiteKeys = [...next].filter((k) => k.startsWith(`${suiteId}:`));

      if (singleOpen) {
        for (const k of suiteKeys) next.delete(k);
        next.add(key);
        return next;
      }

      if (suiteKeys.length >= maxOpenSections) {
        const removable = suiteKeys.find((k) => k !== currentKey) ?? suiteKeys[0];
        if (removable) next.delete(removable);
      }
      next.add(key);
      return next;
    });
  };

  const activeSuite = useMemo(
    () => suites.find((s) => s.id === activeSuiteId) ?? suites[0],
    [suites, activeSuiteId]
  );

  if (!activeSuite) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      <SuiteTabBar suites={suites} activeId={activeSuite.id} onSelect={setActiveSuiteId} />
      <SuiteSectionNav
        suite={activeSuite}
        businessId={businessId}
        pathname={pathname}
        openSections={openSections}
        toggleSection={toggleSection}
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
