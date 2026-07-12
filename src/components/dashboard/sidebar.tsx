"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  Users,
  Grid3X3,
  Award,
  TrendingUp,
  Star,
  Link2,
  KeyRound,
  Bot,
  MapPin,
  Phone,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarUserMenu } from "@/components/auth/sidebar-user-menu";

const navItems = [
  { href: "/businesses", label: "Businesses", icon: Building2 },
  { href: "/agency/clients", label: "Clients", icon: Users },
  { href: "/agency/reports", label: "Reports", icon: FileText },
];

type NavItem = {
  href: string;
  label: string;
  icon: typeof Building2;
  isRankGrid?: boolean;
};

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
          ? "bg-emerald-50 pl-3.5 text-emerald-800"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {showActive && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-600" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", showActive ? "text-emerald-600" : "text-zinc-400")} />
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
        showActive ? "text-emerald-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {dot && showActive && (
        <span className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-600" />
      )}
      {label}
    </Link>
  );
}

function ReputationNavSection({
  businessId,
  pathname,
}: {
  businessId: string;
  pathname: string;
}) {
  const reviewsActive = pathname.includes(`/businesses/${businessId}/reviews`);
  const reviewRequestsActive = pathname.includes(`/businesses/${businessId}/review-requests`);

  return (
    <div className="mb-2">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Reputation
      </p>
      <div className="space-y-0.5">
        <NavLink
          href={`/businesses/${businessId}/reviews`}
          label="Reviews"
          icon={Star}
          active={reviewsActive}
        />
        <NavSubLink
          href={`/businesses/${businessId}/review-requests`}
          label="Review Requests"
          active={reviewRequestsActive}
          dot
        />
      </div>
    </div>
  );
}

function NavSection({
  title,
  items,
  isActive,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string, flags?: { isRankGrid?: boolean }) => boolean;
}) {
  return (
    <div className="mb-2">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href, { isRankGrid: item.isRankGrid })}
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
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3.5">
        <p className="text-sm font-bold text-zinc-900">Maps Growth Agent</p>
      </div>
      <div className="flex-1 p-2.5" />
      {businessId && <div className="border-t border-zinc-100 p-2.5" />}
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

  const mainModules: NavItem[] = businessId
    ? [
        { href: `/businesses/${businessId}/overview`, label: "Overview", icon: LayoutDashboard },
        { href: `/businesses/${businessId}/scans`, label: "Rank Grid", icon: Grid3X3, isRankGrid: true },
        { href: `/businesses/${businessId}/review-momentum`, label: "Review Momentum™", icon: TrendingUp },
      ]
    : [];

  const researchModules: NavItem[] = businessId
    ? [
        { href: `/businesses/${businessId}/backlink-gap`, label: "Backlink Gap", icon: Link2 },
        { href: `/businesses/${businessId}/trust`, label: "Local Trust", icon: Award },
        { href: `/businesses/${businessId}/ai-visibility`, label: "AI Visibility", icon: Bot },
        { href: `/businesses/${businessId}/keywords`, label: "Keywords", icon: KeyRound },
      ]
    : [];

  const reportModules: NavItem[] = businessId
    ? [
        { href: `/businesses/${businessId}/tasks`, label: "Growth Plan", icon: ClipboardList },
        { href: `/businesses/${businessId}/reports`, label: "Reports", icon: FileText },
      ]
    : [];

  function isActive(href: string, flags?: { isRankGrid?: boolean }) {
    if (flags?.isRankGrid && businessId) {
      return pathname.includes(`/businesses/${businessId}/grid/`) || pathname === href;
    }
    if (businessId && href.includes("/review-requests")) {
      return pathname.includes(`/businesses/${businessId}/review-requests`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <Link href="/businesses" className="block truncate text-sm font-bold text-zinc-900">
              Maps Growth Agent
            </Link>
            <p className="text-[11px] text-zinc-500">Local SEO Platform</p>
          </div>
        </div>
        {businessId && (
          <Link
            href="/businesses"
            className="mx-1 mt-2.5 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="min-w-0 flex-1 truncate">
              {businessName ?? "Select business…"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
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
        {businessId && (
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <NavSection title="Main" items={mainModules} isActive={isActive} />
            <ReputationNavSection businessId={businessId} pathname={pathname} />
            <NavSection title="Research" items={researchModules} isActive={isActive} />
            <NavSection title="Reports" items={reportModules} isActive={isActive} />
          </div>
        )}
      </nav>
      {businessId && (
        <div className="space-y-2 border-t border-zinc-100 p-2.5">
          <div className="mx-1 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
            <p className="text-xs font-semibold text-emerald-900">Need help growing?</p>
            <a
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
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
