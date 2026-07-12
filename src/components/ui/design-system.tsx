"use client";

import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreTextClass, trendTextClass } from "@/lib/design/score-colors";

/* ── Layout tokens ───────────────────────────────────────────── */

export const moduleStack = "space-y-6";
export const moduleMaxWidth = "mx-auto w-full max-w-[1600px]";
export const tableHeadClass =
  "bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
export const sectionGap = "mt-8";
export const cardGrid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";
export const cardGrid3 = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/* ── Surface tokens ──────────────────────────────────────────── */

export const cardClass =
  "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
export const cardPadding = "p-5";
export const filterBarClass =
  "flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

/* ── Typography tokens ───────────────────────────────────────── */

export const pageTitleClass = "text-2xl font-bold tracking-tight text-zinc-900";
export const pageSubtitleClass = "mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-500";
export const sectionTitleClass = "text-base font-semibold text-zinc-900";
export const cardLabelClass = "text-xs font-medium uppercase tracking-wide text-zinc-500";
export const bodyClass = "text-sm leading-relaxed text-zinc-600";

/* ── Button tokens ───────────────────────────────────────────── */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 disabled:opacity-50";

export const btnIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300";

export const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20";

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
  return <div className={cn(moduleStack, wide && moduleMaxWidth, className)}>{children}</div>;
}

export function ModuleHeader({
  title,
  subtitle,
  meta,
  actions,
  icon: Icon,
  className,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
          <h1 className={pageTitleClass}>{title}</h1>
        </div>
        {subtitle ? <p className={pageSubtitleClass}>{subtitle}</p> : null}
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
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
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className={sectionTitleClass}>{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-zinc-500">{subtitle}</p> : null}
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
      <div className="flex flex-wrap gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-1 pb-3 pt-0.5 text-sm transition-colors",
              active === tab.id
                ? "border-emerald-600 font-semibold text-emerald-700"
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
        "text-3xl font-bold tabular-nums leading-none",
        score != null ? scoreTextClass(score) : "text-zinc-900",
        className
      )}
    >
      {value}
      {suffix ? <span className="ml-0.5 text-lg font-normal text-zinc-400">{suffix}</span> : null}
    </p>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  sub,
  icon: Icon,
  iconWrapClassName = "bg-emerald-50 text-emerald-600",
  trend,
  score,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  iconWrapClassName?: string;
  trend?: number | null;
  score?: number | null;
  className?: string;
}) {
  return (
    <div className={cn(cardClass, "p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cardLabelClass}>{label}</p>
          <div className="mt-2">
            <StatValue value={value} suffix={suffix} score={score} />
          </div>
          {sub ? <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{sub}</p> : null}
          {trend != null && trend !== 0 ? (
            <p className={cn("mt-1 text-xs font-medium", trendTextClass(trend))}>
              {trend > 0 ? "+" : ""}
              {trend} vs last
            </p>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              iconWrapClassName
            )}
          >
            <Icon className="h-4 w-4" />
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
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-relaxed text-zinc-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
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
    <div className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", styles[variant], className)}>
      {children}
    </div>
  );
}
