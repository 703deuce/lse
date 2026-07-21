import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared visual language matching the product mockups. */
export const mock = {
  page: "space-y-5",
  card: "rounded-xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
  cardPad: "rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
  title: "text-[28px] font-bold tracking-tight text-[#101828]",
  subtitle: "mt-1 text-sm text-[#667085]",
  label: "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]",
  btnPrimary:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white transition hover:bg-[#0f6244]",
  btnSecondary:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]",
  btnGhost:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#475467] transition hover:bg-[#F2F4F7]",
  link: "text-sm font-semibold text-[#137752] hover:underline",
  tableHead:
    "bg-[#F9FAFB] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]",
  tableCell: "px-4 py-3.5 text-sm text-[#344054]",
  badgeGreen:
    "inline-flex items-center rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#027A48]",
  badgeAmber:
    "inline-flex items-center rounded-full bg-[#FFFAEB] px-2 py-0.5 text-[11px] font-semibold text-[#B54708]",
  badgeRed:
    "inline-flex items-center rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[11px] font-semibold text-[#B42318]",
  banner:
    "flex flex-col gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
};

export function MockPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className={mock.title}>{title}</h1>
        {subtitle ? <p className={mock.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MockMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  trend,
  trendPositive,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  return (
    <div className={cn(mock.card, "flex items-start gap-3 p-4")}>
      {Icon ? (
        <span
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]",
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className={mock.label}>{label}</p>
        <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-[#101828]">{value}</p>
        {hint || trend ? (
          <p className="mt-1.5 text-xs text-[#667085]">
            {trend ? (
              <span
                className={cn(
                  "mr-1.5 font-semibold",
                  trendPositive === false ? "text-[#B42318]" : "text-[#027A48]"
                )}
              >
                {trend}
              </span>
            ) : null}
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MockHelpBanner({
  children,
  actions,
  icon: Icon,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className={mock.banner}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#137752] shadow-sm">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="text-sm leading-relaxed text-[#027A48]">{children}</div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function MockTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; href?: string }>;
  active: string;
  onChange?: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#E6EAF0]">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const className = cn(
          "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition",
          isActive
            ? "border-[#137752] text-[#137752]"
            : "border-transparent text-[#667085] hover:text-[#344054]"
        );
        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} className={className}>
              {tab.label}
            </Link>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            className={className}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function MockTableShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(mock.card, "overflow-hidden")}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] px-4 py-3.5">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#101828]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
