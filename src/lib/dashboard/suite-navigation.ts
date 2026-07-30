import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileSearch,
  FileText,
  FolderKanban,
  Grid3X3,
  History,
  LayoutDashboard,
  Link2,
  Mail,
  MapPin,
  MessageSquareText,
  Palette,
  Phone,
  QrCode,
  Send,
  Settings,
  Settings2,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { toolHref, type LocationToolSlug } from "@/lib/dashboard/tool-modules";
import { isSidebarHrefActive } from "@/components/dashboard/dashboard-nav";

export type SuiteId = "local-seo" | "reviews" | "agency" | "settings";

export type SuiteNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  locked?: boolean;
  badge?: string;
  isRankGrid?: boolean;
};

export type SuiteNavSection = {
  id: string;
  label: string;
  items: SuiteNavLink[];
};

export type AppSuite = {
  id: SuiteId;
  label: string;
  icon: LucideIcon;
  agencyOnly?: boolean;
  sections: SuiteNavSection[];
};

export type SuiteNavOptions = {
  trial?: boolean;
  showAgencySuite?: boolean;
};

function loc(slug: LocationToolSlug, businessId?: string | null): string {
  return toolHref(slug, businessId);
}

function upgradeHref(feature: string) {
  return `/settings/subscription?upgrade=${encodeURIComponent(feature)}`;
}

function item(
  href: string,
  label: string,
  icon: LucideIcon,
  opts?: { locked?: boolean; badge?: string; isRankGrid?: boolean }
): SuiteNavLink {
  return { href, label, icon, ...opts };
}

export function buildAppSuites(
  businessId?: string | null,
  options?: SuiteNavOptions
): AppSuite[] {
  const trial = Boolean(options?.trial);
  const showAgency = Boolean(options?.showAgencySuite);

  const businessSettingsHref = businessId ? `/businesses/${businessId}/settings` : "/settings";
  const requestHistoryHref = businessId
    ? `${loc("review-requests", businessId)}?tab=bulk`
    : "/tools/go/review-requests?tab=bulk";
  const messagingStatusHref = businessId
    ? `${loc("messaging", businessId)}/status`
    : "/tools/go/messaging/status";
  const messagingNumberHref = businessId
    ? `${loc("messaging", businessId)}/number`
    : "/tools/go/messaging/number";
  const campaignsHref = loc("review-campaigns", businessId);

  const lock = (feature: string, slug: LocationToolSlug, label: string, icon: LucideIcon) =>
    trial
      ? item(upgradeHref(feature), label, icon, { locked: true, badge: "Locked" })
      : item(loc(slug, businessId), label, icon);

  const lockHref = (feature: string, href: string, label: string, icon: LucideIcon) =>
    trial
      ? item(upgradeHref(feature), label, icon, { locked: true, badge: "Locked" })
      : item(href, label, icon);

  const suites: AppSuite[] = [
    {
      id: "local-seo",
      label: "Local SEO",
      icon: MapPin,
      sections: [
        {
          id: "maps",
          label: "Maps",
          items: [
            item(loc("dashboard", businessId), "Dashboard", LayoutDashboard),
            item(loc("maps-scans", businessId), "Overview", Grid3X3, { isRankGrid: true }),
            item(loc("maps-scans", businessId), "New Scan", Grid3X3, { isRankGrid: true }),
            item("/scans", "Recent Scans", History),
            item("/scans", "Scan History", History),
            lock("keywords", "maps-campaigns", "Maps Campaigns", FolderKanban),
            lock("keywords", "keywords", "Keywords", FolderKanban),
            item("/tools/google-maps-rank-checker", "Scan Maps", Grid3X3),
          ],
        },
        {
          id: "optimization",
          label: "Optimization",
          items: [
            lock("complete-audit", "growth-audit", "Google Business Profile Audit", FileSearch),
            lock("complete-audit", "growth-audit", "Complete Audit", ClipboardList),
            item(loc("local-seo-health", businessId), "Health Assessment", FileSearch),
            item(loc("tasks", businessId), "Growth Plan", ClipboardList),
          ],
        },
        {
          id: "competitive-research",
          label: "Competitive Research",
          items: [
            item(loc("review-competitors", businessId), "Competitors", Swords),
            item(loc("backlink-gap", businessId), "Backlink Opportunities", Link2),
            item(loc("trust", businessId), "Local Sponsorships", Award),
            item(loc("ai-visibility", businessId), "AI Visibility", Bot),
          ],
        },
        {
          id: "reports",
          label: "Reports",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: Star,
      sections: [
        {
          id: "overview",
          label: "Overview",
          items: [item(loc("review-overview", businessId), "Overview", Sparkles)],
        },
        {
          id: "reviews",
          label: "Reviews",
          items: [
            item(loc("reviews", businessId), "Reviews", Star),
            item(loc("review-analytics", businessId), "Review Velocity", TrendingUp),
            item(loc("review-insights", businessId), "Insights", Sparkles),
            item(loc("review-competitors", businessId), "Competitors", Swords),
          ],
        },
        {
          id: "requests",
          label: "Requests",
          items: [
            item(loc("review-requests", businessId), "Send Request", Send),
            item(loc("contacts", businessId), "Contacts", Users),
            item(loc("contacts", businessId), "Customers", Users),
            item(requestHistoryHref, "Request History", History),
          ],
        },
        {
          id: "campaigns",
          label: "Campaigns",
          items: [
            lockHref("campaigns", `${campaignsHref}?channel=sms`, "SMS Campaigns", MessageSquareText),
            lockHref("campaigns", `${campaignsHref}?channel=email`, "Email Campaigns", Mail),
            item(loc("review-templates", businessId), "Templates", FileText),
            item(loc("integrations", businessId), "Automations", Webhook),
            item(loc("review-alerts", businessId), "Alerts", Bell),
          ],
        },
        {
          id: "phone-numbers",
          label: "Phone Numbers",
          items: [
            lockHref("messaging", messagingStatusHref, "Registration", Phone),
            lockHref("messaging", messagingNumberHref, "Phone Numbers", Phone),
          ],
        },
        {
          id: "marketing",
          label: "Marketing",
          items: [
            item(loc("review-qr", businessId), "QR Campaigns", QrCode),
            item(loc("review-qr", businessId), "QR Code & Review Link", Link2),
            item("/tools/google-review-widget", "Review Widget", Star),
          ],
        },
        {
          id: "management",
          label: "Management",
          items: [
            item("/tools/review-response-generator", "Review Reply", MessageSquareText),
            item(loc("reputation-audit", businessId), "Reputation Audit", FileSearch),
            item(loc("review-settings", businessId), "Reputation Settings", Settings2),
            item(loc("review-settings", businessId), "Review Sites", Settings2),
          ],
        },
        {
          id: "reports",
          label: "Reports",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      sections: [
        {
          id: "get-started",
          label: "Get Started",
          items: [item("/onboarding", "Get Started", MapPin)],
        },
        {
          id: "account",
          label: "Account",
          items: [item("/settings", "Account", Settings)],
        },
        {
          id: "business-profile",
          label: "Business Profile",
          items: [item(businessSettingsHref, "Business Profile", Building2)],
        },
        {
          id: "billing",
          label: "Billing",
          items: [item("/settings/subscription", "Billing", CreditCard)],
        },
        {
          id: "branding",
          label: "Branding",
          items: [item("/branding", "Branding", Palette)],
        },
        {
          id: "settings-hub",
          label: "Settings",
          items: [item("/settings", "Settings", Settings)],
        },
      ],
    },
  ];

  if (showAgency) {
    suites.splice(2, 0, {
      id: "agency",
      label: "Agency",
      icon: Building2,
      agencyOnly: true,
      sections: [
        {
          id: "workspace",
          label: "Workspace",
          items: [item("/workspace", "Workspace", Briefcase)],
        },
        {
          id: "prospects",
          label: "Prospects",
          items: [
            item("/prospects", "All Prospects", Users),
            item("/prospects/audits", "Prospect Audits", FileSearch),
          ],
        },
        {
          id: "clients",
          label: "Clients",
          items: [
            item("/clients", "Clients", Building2),
            item("/businesses", "Business Profiles", Building2),
          ],
        },
        {
          id: "branding",
          label: "Branding",
          items: [item("/branding", "Branding", Palette)],
        },
        {
          id: "billing",
          label: "Billing",
          items: [item("/settings/subscription", "Billing", CreditCard)],
        },
        {
          id: "reports",
          label: "Reports",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    });
  }

  return suites;
}

/** Flatten all links for path matching. */
export function flattenSuiteLinks(suites: AppSuite[]): SuiteNavLink[] {
  const out: SuiteNavLink[] = [];
  for (const suite of suites) {
    for (const section of suite.sections) {
      out.push(...section.items);
    }
  }
  return out;
}

export function resolveSuiteNavContext(
  pathname: string,
  suites: AppSuite[],
  businessId?: string | null
): { suiteId: SuiteId; sectionId: string } | null {
  for (const suite of suites) {
    for (const section of suite.sections) {
      for (const link of section.items) {
        if (
          isSidebarHrefActive(pathname, link.href, businessId, {
            isRankGrid: link.isRankGrid,
          })
        ) {
          return { suiteId: suite.id, sectionId: section.id };
        }
      }
    }
  }

  if (pathname.includes("/messaging") || pathname.includes("/automations") || pathname.includes("/alerts")) {
    const reviews = suites.find((s) => s.id === "reviews");
    if (reviews) {
      if (pathname.includes("/messaging")) {
        const phone = reviews.sections.find((s) => s.id === "phone-numbers");
        if (phone) return { suiteId: "reviews", sectionId: phone.id };
      }
      const campaigns = reviews.sections.find((s) => s.id === "campaigns");
      if (campaigns) return { suiteId: "reviews", sectionId: campaigns.id };
    }
  }

  if (
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/prospects") ||
    pathname.startsWith("/clients") ||
    pathname === "/businesses"
  ) {
    const agency = suites.find((s) => s.id === "agency");
    if (agency) {
      if (pathname.startsWith("/prospects")) return { suiteId: "agency", sectionId: "prospects" };
      if (pathname.startsWith("/clients")) return { suiteId: "agency", sectionId: "clients" };
      if (pathname === "/businesses" || pathname.startsWith("/businesses?")) {
        return { suiteId: "agency", sectionId: "clients" };
      }
      return { suiteId: "agency", sectionId: "workspace" };
    }
  }

  if (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/branding")
  ) {
    if (pathname.startsWith("/onboarding")) return { suiteId: "settings", sectionId: "get-started" };
    if (pathname.startsWith("/branding")) return { suiteId: "settings", sectionId: "branding" };
    if (pathname.includes("/subscription")) return { suiteId: "settings", sectionId: "billing" };
    return { suiteId: "settings", sectionId: "settings-hub" };
  }

  if (businessId && pathname === `/businesses/${businessId}/settings`) {
    return { suiteId: "settings", sectionId: "business-profile" };
  }

  return null;
}
