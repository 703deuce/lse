"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Settings,
  Users,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarUserMenu } from "@/components/auth/sidebar-user-menu";
import {
  buildBusinessSidebarNav,
  isSidebarHrefActive,
  type SidebarNavItem,
} from "@/components/dashboard/dashboard-nav";

const navItems = [
  { href: "/businesses", label: "Businesses", icon: Building2 },
  { href: "/agency/clients", label: "Clients", icon: Users },
  { href: "/agency/reports", label: "Reports", icon: FileText },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Building2;
  active: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showActive = mounted && active;

  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        showActive
          ? "bg-emerald-500/15 pl-3.5 text-emerald-300"
          : "text-sidebar-text hover:bg-[var(--sidebar-hover)] hover:text-slate-200"
      )}
    >
      {showActive && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-500" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", showActive ? "text-emerald-400" : "text-sidebar-text-muted")} />
      {label}
    </Link>
  );
}

function NavSubLink({
  href,
  label,
  active,
  dot,
}: {
  href: string;
  label: string;
  active: boolean;
  dot?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showActive = mounted && active;

  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={cn(
        "relative flex items-center gap-2 rounded-md py-1.5 pl-8 pr-3 text-[13px] font-medium transition-colors",
        showActive ? "text-emerald-300" : "text-sidebar-text hover:bg-[var(--sidebar-hover)] hover:text-slate-200"
      )}
    >
      {dot && showActive && (
        <span className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400" />
      )}
      {label}
    </Link>
  );
}

function NavSection({
  title,
  items,
  businessId,
  pathname,
}: {
  title: string;
  items: SidebarNavItem[];
  businessId: string;
  pathname: string;
}) {
  return (
    <div className="mb-2">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isSidebarHrefActive(pathname, item.href, businessId, { isRankGrid: item.isRankGrid })}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSidebar({
  businessId,
}: {
  businessId?: string;
  /** @deprecated Compare is opened from Rank Grid, not the sidebar */
  compareActive?: boolean;
}) {
  return (
    <Suspense fallback={<SidebarFallback businessId={businessId} />}>
      <DashboardSidebarInner businessId={businessId} />
    </Suspense>
  );
}

function SidebarFallback({ businessId }: { businessId?: string }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <p className="text-sm font-bold text-white">Maps Growth Agent</p>
      </div>
      <div className="flex-1 p-2.5" />
      {businessId && <div className="border-t border-sidebar-border p-2.5" />}
    </aside>
  );
}

function DashboardSidebarInner({ businessId }: { businessId?: string }) {
  const pathname = usePathname();
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    void fetch(`/api/reputation/review-link/${businessId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.businessName) setBusinessName(json.businessName as string);
      })
      .catch(() => undefined);
  }, [businessId]);

  const nav = businessId ? buildBusinessSidebarNav(businessId) : null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <Link href="/businesses" className="block truncate text-sm font-bold text-white">
              Maps Growth Agent
            </Link>
            <p className="text-[11px] text-sidebar-text-muted">Local SEO Platform</p>
          </div>
        </div>
        {businessId && (
          <Link
            href="/businesses"
            className="mx-1 mt-2.5 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-text-muted" />
            <span className="min-w-0 flex-1 truncate">
              {businessName ?? "Select business…"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-text-muted" />
          </Link>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5" suppressHydrationWarning>
        {!businessId &&
          navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={
                item.href === "/businesses"
                  ? pathname === "/businesses"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
            />
          ))}
        {nav && (
          <div className="mt-3 border-t border-sidebar-border pt-3">
            <NavSection title={nav.main.title} items={nav.main.items} businessId={businessId!} pathname={pathname} />
            <div className="mb-2">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">
                {nav.reputation.title}
              </p>
              <div className="space-y-0.5">
                {nav.reputation.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isSidebarHrefActive(pathname, item.href, businessId!)}
                  />
                ))}
                {nav.reputation.subLinks.map((item) => (
                  <NavSubLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isSidebarHrefActive(pathname, item.href, businessId!)}
                    dot
                  />
                ))}
              </div>
            </div>
            <NavSection title={nav.research.title} items={nav.research.items} businessId={businessId!} pathname={pathname} />
            <NavSection title={nav.reports.title} items={nav.reports.items} businessId={businessId!} pathname={pathname} />
          </div>
        )}
      </nav>
      {businessId && (
        <div className="space-y-2 border-t border-sidebar-border p-2.5">
          <div className="mx-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
            <p className="text-xs font-semibold text-emerald-200">Need help growing?</p>
            <a
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Phone className="h-3.5 w-3.5" />
              Book a Strategy Call
            </a>
          </div>
          <NavLink
            href={`/businesses/${businessId}/settings`}
            label="Settings"
            icon={Settings}
            active={pathname.startsWith(`/businesses/${businessId}/settings`)}
          />
          <SidebarUserMenu />
        </div>
      )}
    </aside>
  );
}
