"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ComponentType } from "react";
import {
  Building2,
  ChevronDown,
  MapPin,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarUserMenu } from "@/components/auth/sidebar-user-menu";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import {
  buildUnifiedSidebarNav,
  isSidebarHrefActive,
  type SidebarNavItem,
} from "@/components/dashboard/dashboard-nav";

function SidebarNavItemRow({
  href,
  label,
  icon: Icon,
  active,
  staticLinks,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  staticLinks?: boolean;
  onNavigate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showActive = mounted && active;

  const className = cn(
    "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
    showActive
      ? "bg-emerald-500/15 pl-3.5 text-emerald-300"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  );

  const content = (
    <>
      {showActive && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-500" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", showActive ? "text-emerald-400" : "text-slate-400")} />
      {label}
    </>
  );

  if (staticLinks) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={className}
      onClick={() => onNavigate?.()}
    >
      {content}
    </Link>
  );
}

function SidebarNavSubItemRow({
  href,
  label,
  active,
  dot,
  staticLinks,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  dot?: boolean;
  staticLinks?: boolean;
  onNavigate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showActive = mounted && active;

  const className = cn(
    "relative flex items-center gap-2 rounded-md py-1.5 pl-9 pr-3 text-[12px] font-medium transition-colors",
    showActive ? "text-emerald-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
  );

  const content = (
    <>
      {dot && showActive && (
        <span className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400" />
      )}
      {label}
    </>
  );

  if (staticLinks) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={className}
      onClick={() => onNavigate?.()}
    >
      {content}
    </Link>
  );
}

function NavSection({
  title,
  items,
  businessId,
  pathname,
  staticLinks,
  onNavigate,
}: {
  title: string;
  items: SidebarNavItem[];
  businessId?: string | null;
  pathname: string;
  staticLinks?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-2">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div key={`${item.label}-${item.href}`}>
            <SidebarNavItemRow
              href={item.href}
              label={item.badge ? `${item.label} · ${item.badge}` : item.label}
              icon={item.icon}
              active={isSidebarHrefActive(pathname, item.href, businessId, {
                isRankGrid: item.isRankGrid,
                exact: Boolean(item.children?.length),
              })}
              staticLinks={staticLinks}
              onNavigate={onNavigate}
            />
            {item.children?.map((child) => (
              <SidebarNavSubItemRow
                key={child.href}
                href={child.href}
                label={child.badge ? `${child.label} · ${child.badge}` : child.label}
                active={isSidebarHrefActive(pathname, child.href, businessId)}
                dot
                staticLinks={staticLinks}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSidebarPanel({
  businessId,
  pathname,
  businessName,
  staticLinks = false,
  showFooter = true,
  className,
  onNavigate,
}: {
  businessId?: string;
  pathname: string;
  businessName?: string | null;
  staticLinks?: boolean;
  showFooter?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const nav = buildUnifiedSidebarNav(businessId);

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className ?? "flex"
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#137752]">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            {staticLinks ? (
              <p className="truncate text-sm font-bold text-white">Local SEO Express</p>
            ) : (
              <Link
                href="/workspace"
                className="block truncate text-sm font-bold text-white"
                onClick={() => onNavigate?.()}
              >
                Local SEO Express
              </Link>
            )}
            <p className="text-[11px] text-slate-400">Independent consultants · 1–20 clients</p>
          </div>
        </div>
        {staticLinks ? (
          <div className="mx-1 mt-2.5 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">
              {businessName ?? "Select client or prospect…"}
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

      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2.5" suppressHydrationWarning>
        <div className="mb-2">
          <SidebarNavItemRow
            href={nav.getStarted.href}
            label={nav.getStarted.label}
            icon={nav.getStarted.icon}
            active={isSidebarHrefActive(pathname, nav.getStarted.href, businessId)}
            staticLinks={staticLinks}
            onNavigate={onNavigate}
          />
        </div>

        <NavSection
          title={nav.work.title}
          items={nav.work.items}
          businessId={businessId}
          pathname={pathname}
          staticLinks={staticLinks}
          onNavigate={onNavigate}
        />

        <NavSection
          title={nav.growthTools.title}
          items={nav.growthTools.items}
          businessId={businessId}
          pathname={pathname}
          staticLinks={staticLinks}
          onNavigate={onNavigate}
        />
        <NavSection
          title={nav.reputation.title}
          items={nav.reputation.items}
          businessId={businessId}
          pathname={pathname}
          staticLinks={staticLinks}
          onNavigate={onNavigate}
        />
        <NavSection
          title={nav.deliverables.title}
          items={nav.deliverables.items}
          businessId={businessId}
          pathname={pathname}
          staticLinks={staticLinks}
          onNavigate={onNavigate}
        />
        <NavSection
          title={nav.account.title}
          items={nav.account.items}
          businessId={businessId}
          pathname={pathname}
          staticLinks={staticLinks}
          onNavigate={onNavigate}
        />
      </nav>

      {showFooter && !staticLinks && (
        <div className="space-y-2 border-t border-sidebar-border p-2.5">
          {businessId ? (
            <SidebarNavItemRow
              href={`/businesses/${businessId}/settings`}
              label="Location settings"
              icon={Settings}
              active={pathname.startsWith(`/businesses/${businessId}/settings`)}
              onNavigate={onNavigate}
            />
          ) : null}
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
  /** @deprecated Compare is opened from Rank Grid, not the sidebar */
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

  return (
    <DashboardSidebarPanel
      businessId={businessId}
      pathname={pathname}
      businessName={businessName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
