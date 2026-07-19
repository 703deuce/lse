"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Bot,
  Building2,
  FileSearch,
  FileText,
  FolderKanban,
  KeyRound,
  Link2,
  Radar,
  Settings,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useDashboardUI } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

type MoreItem = {
  href: string;
  label: string;
  icon: typeof Radar;
  badge?: string;
};

function businessIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/businesses\/([^/]+)/);
  if (m?.[1] && m[1] !== "new") return m[1];
  const c = pathname.match(/\/clients\/([^/]+)/);
  if (c?.[1]) return c[1];
  const p = pathname.match(/\/prospects\/([^/]+)/);
  if (p?.[1]) return p[1];
  return null;
}

/**
 * Curated mobile More menu — important tools one tap away.
 */
export function MobileMoreSheet() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useDashboardUI();
  const businessId = businessIdFromPath(pathname);

  if (!mobileNavOpen) return null;

  const orgItems: MoreItem[] = [
    { href: "/prospects", label: "Prospects", icon: Target },
    { href: "/clients", label: "Clients", icon: Building2 },
    { href: "/scans", label: "Maps Scans", icon: Radar },
    { href: "/workspace", label: "Workspace", icon: FolderKanban },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/branding", label: "Branding", icon: Sparkles },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const bizItems: MoreItem[] = businessId
    ? [
        { href: `/businesses/${businessId}/campaigns`, label: "Maps Campaigns", icon: FolderKanban },
        { href: `/businesses/${businessId}/growth-audit`, label: "Growth Audit", icon: FileSearch },
        { href: `/businesses/${businessId}/backlink-gap`, label: "Backlink Gap", icon: Link2 },
        { href: `/businesses/${businessId}/trust`, label: "Local Trust", icon: Award },
        { href: `/businesses/${businessId}/keywords`, label: "Keywords", icon: KeyRound },
        { href: `/businesses/${businessId}/ai-visibility`, label: "AI Visibility", icon: Bot },
        { href: `/businesses/${businessId}/competitors`, label: "Competitors", icon: Radar },
        { href: `/businesses/${businessId}/reviews`, label: "Review Feed", icon: Star },
        { href: `/businesses/${businessId}/reviews/momentum`, label: "Review Momentum", icon: Star },
        {
          href: `/businesses/${businessId}/review-requests`,
          label: "Review Requests",
          icon: Star,
          badge: "Add-on",
        },
        { href: `/businesses/${businessId}/reports`, label: "Reports", icon: FileText },
        { href: "/branding", label: "Branding", icon: Sparkles },
        { href: "/settings", label: "Settings", icon: Settings },
      ]
    : orgItems;

  const close = () => setMobileNavOpen(false);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40"
        aria-label="Close menu"
        onClick={close}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">More tools</p>
            <p className="text-[11px] text-zinc-500">
              {businessId ? "Tools for this location" : "Workspace tools"}
            </p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2 p-3">
          {bizItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-white px-3 py-3 text-[13px] font-medium shadow-sm",
                    active
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                      : "text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      active
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        : "bg-emerald-50 text-emerald-600 ring-emerald-100"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {!businessId ? (
          <p className="px-4 pb-4 text-[11px] text-zinc-500">
            Open a client to see Growth Audit, Backlink Gap, Local Trust, and other location tools.
          </p>
        ) : (
          <div className="border-t border-zinc-100 px-3 py-3">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Workspace
            </p>
            <ul className="grid grid-cols-2 gap-1">
              {orgItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={`org-${item.href}`}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50"
                    >
                      <Icon className="h-3.5 w-3.5 text-zinc-400" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
