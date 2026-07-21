"use client";

import type { ComponentType, ReactNode } from "react";
import { isValidElement } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { scoreTextClass, trendTextClass } from "@/lib/design/score-colors";

/** Lucide component OR already-rendered node (required when Server → Client). */
export type ModuleIcon = LucideIcon | ReactNode;

function renderModuleIcon(icon: ModuleIcon | undefined, className: string) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in icon)) {
    const Icon = icon as ComponentType<{ className?: string }>;
    return <Icon className={className} />;
  }
  return null;
}

/* ── Layout tokens ───────────────────────────────────────────── */

export const moduleStack = "space-y-5";
export const moduleMaxWidth = "mx-auto w-full max-w-[1600px]";
export const tableHeadClass =
  "bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500";
export const sectionGap = "mt-6";
export const cardGrid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";
export const cardGrid3 = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

/* ── Surface tokens — varied weight, not identical cards ─────── */

/** Standard content surface */
export const cardClass =
  "rounded-md border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";
export const cardPadding = "p-4";
/** Dominant page hero — larger, left accent, more presence */
export const heroClass =
  "relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#137752]";
/** Quiet inset / secondary strip */
export const insetClass = "rounded-md border border-zinc-200/70 bg-zinc-50/80";
/** Divided list / table shell */
export const listClass =
  "divide-y divide-zinc-100 overflow-hidden rounded-md border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";
export const emptyStateClass =
  "rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 px-5 py-10 text-center";
export const tableCellClass = "px-3.5 py-3";
export const tableHeadCellClass = "px-3.5 py-2.5";
export const tableRowHoverClass = "transition-colors hover:bg-zinc-50/90";
export const filterBarClass =
  "flex flex-wrap items-end gap-2 rounded-md border border-zinc-200/90 bg-white p-3";

/* ── Typography scale (32 / 24 / 20 / 16 / 14 / 12) ───────────── */

export const displayTitleClass =
  "text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]";
export const pageTitleClass =
  "text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-2xl";
export const pageSubtitleClass = "mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500";
export const sectionTitleClass = "text-base font-semibold tracking-tight text-zinc-900";
export const cardLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500";
export const bodyClass = "text-sm leading-relaxed text-zinc-600";
export const microClass = "text-xs leading-snug text-zinc-500";
/** Hero KPI number */
export const heroMetricClass =
  "text-[40px] font-semibold tabular-nums leading-none tracking-tight text-zinc-900 sm:text-[48px]";
/** Secondary metric number */
export const secondaryMetricClass =
  "text-xl font-semibold tabular-nums leading-none tracking-tight text-zinc-900";

/* ── Icon well (consistent treatment) ────────────────────────── */

export const iconWellClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-[#137752]";
export const iconWellSmClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#137752]";

/* ── Button tokens ───────────────────────────────────────────── */

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-[#137752] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f6344] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137752] disabled:opacity-50";

export const btnPrimaryLg =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#137752] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0f6344] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137752] disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";

export const btnIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300";

export const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25";

export const fieldLabelClass = "text-xs font-medium text-zinc-600";

/* ── Layout wrappers ─────────────────────────────────────────── */

export function ModulePage({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn(moduleStack, "min-w-0 overflow-x-hidden", wide && moduleMaxWidth, className)}>
      {children}
    </div>
  );
}

export function ModuleHeader({
  title,
  subtitle,
  meta,
  actions,
  icon,
  className,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Prefer JSX from Server Components: icon={<Radar className="h-5 w-5 text-emerald-600" />}. LucideIcon refs only work Client→Client. */
  icon?: ModuleIcon;
  className?: string;
}) {
  const iconNode = renderModuleIcon(icon, "h-4 w-4");
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4 pb-1", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          {iconNode ? <span className={iconWellClass}>{iconNode}</span> : null}
          <h1 className={pageTitleClass}>{title}</h1>
        </div>
        {subtitle ? <p className={pageSubtitleClass}>{subtitle}</p> : null}
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/** One dominant section per page — creates visual hierarchy. */
export function HeroPanel({
  eyebrow,
  title,
  description,
  metric,
  metricLabel,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  metric?: ReactNode;
  metricLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(heroClass, "px-5 py-5 sm:px-6 sm:py-6", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#137752]">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className={cn(displayTitleClass, eyebrow ? "mt-2" : undefined)}>{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">{description}</p>
          ) : null}
          {children}
        </div>
        {(metric != null || actions) && (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end lg:shrink-0">
            {metric != null ? (
              <div>
                {metricLabel ? <p className={cardLabelClass}>{metricLabel}</p> : null}
                <div className={cn(metricLabel ? "mt-1.5" : undefined)}>{metric}</div>
              </div>
            ) : null}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

/** Compact secondary metrics under a hero — less weight than StatCards. */
export function MetricStrip({
  items,
  className,
}: {
  items: Array<{ label: string; value: string; href?: string }>;
  className?: string;
}) {
  const cols =
    items.length <= 2
      ? "sm:grid-cols-2"
      : items.length === 3
        ? "sm:grid-cols-3"
        : items.length === 5
          ? "sm:grid-cols-5"
          : "sm:grid-cols-4";
  return (
    <div
      className={cn(
        insetClass,
        "grid divide-y divide-zinc-200/80 sm:divide-x sm:divide-y-0",
        cols,
        className
      )}
    >
      {items.map((item) => {
        const inner = (
          <>
            <p className={cardLabelClass}>{item.label}</p>
            <p className={cn(secondaryMetricClass, "mt-1.5 text-lg")}>{item.value}</p>
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="block px-4 py-3 transition hover:bg-white"
          >
            {inner}
          </Link>
        ) : (
          <div key={item.label} className="px-4 py-3">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Premium table shell — stronger headers, clearer row emphasis. */
export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(listClass, className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function PageToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-start justify-between gap-3", className)}>
      <div>
        <h2 className={sectionTitleClass}>{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────────── */

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; muted?: boolean }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("-mb-px border-b border-zinc-200", className)}>
      <div className="-mx-1 flex flex-nowrap gap-0 overflow-x-auto px-1 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 pb-2 pt-0.5 text-[13px] transition-colors",
              active === tab.id
                ? "border-[#137752] font-semibold text-[#137752]"
                : tab.muted
                  ? "border-transparent font-medium text-zinc-400 hover:text-zinc-600"
                  : "border-transparent font-medium text-zinc-500 hover:text-zinc-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Cards ───────────────────────────────────────────────────── */

export function ContentCard({
  children,
  className,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={cn(cardClass, padding && cardPadding, className)}>{children}</div>
  );
}

export function StatValue({
  value,
  suffix,
  className,
  score,
}: {
  value: string | number;
  suffix?: string;
  className?: string;
  score?: number | null;
}) {
  return (
    <p
      className={cn(
        "text-2xl font-semibold tabular-nums leading-none tracking-tight",
        score != null ? scoreTextClass(score) : "text-zinc-900",
        className
      )}
    >
      {value}
      {suffix ? <span className="ml-0.5 text-xs font-normal text-zinc-400">{suffix}</span> : null}
    </p>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  sub,
  icon,
  iconWrapClassName = "bg-emerald-50 text-emerald-700",
  trend,
  score,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  icon?: ModuleIcon;
  iconWrapClassName?: string;
  trend?: number | null;
  score?: number | null;
  className?: string;
}) {
  const iconNode = renderModuleIcon(icon, "h-3.5 w-3.5");
  return (
    <div className={cn(cardClass, "px-3.5 py-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cardLabelClass}>{label}</p>
          <div className="mt-1.5">
            <StatValue value={value} suffix={suffix} score={score} />
          </div>
          {sub ? <p className="mt-1 text-[11px] leading-snug text-zinc-500">{sub}</p> : null}
          {trend != null && trend !== 0 ? (
            <p className={cn("mt-0.5 text-[11px] font-medium", trendTextClass(trend))}>
              {trend > 0 ? "+" : ""}
              {trend} vs last
            </p>
          ) : null}
        </div>
        {iconNode ? (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              iconWrapClassName
            )}
          >
            {iconNode}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function KpiGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 3 | 4; className?: string }) {
  return (
    <div className={cn(cols === 3 ? cardGrid3 : cardGrid, className)}>{children}</div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        cardClass,
        "flex flex-col items-center justify-center px-4 py-7 text-center",
        className
      )}
    >
      <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-[12px] leading-snug text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function AlertBanner({
  children,
  variant = "info",
  className,
}: {
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  className?: string;
}) {
  const styles = {
    info: "border-zinc-200 bg-zinc-50 text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={cn("rounded-md border px-3 py-2 text-[13px] leading-snug", styles[variant], className)}>
      {children}
    </div>
  );
}

/** Enterprise skeleton placeholder — prefer over spinner-only loading. */
export function ModuleSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn(cardClass, "overflow-hidden", className)} aria-busy="true" aria-live="polite">
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-3.5 py-2.5">
        <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 max-w-[40%] animate-pulse rounded bg-zinc-200" />
              <div className="h-2.5 max-w-[70%] animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="hidden h-6 w-16 animate-pulse rounded bg-zinc-100 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(cardGrid, className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(cardClass, "px-3.5 py-3")}>
          <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-200" />
          <div className="mt-2.5 h-5 w-20 animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-2 w-24 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}
