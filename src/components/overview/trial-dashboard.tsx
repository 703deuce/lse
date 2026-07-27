import Link from "next/link";
import {
  FileSearch,
  Grid3X3,
  KeyRound,
  Link2,
  Lock,
  MessageSquareText,
  QrCode,
  Sparkles,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TrialDashboardProps = {
  businessId: string;
  businessName: string;
  userName?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  creditsUsed?: number;
  creditsLimit?: number;
  recentScans?: {
    id: string;
    keyword: string;
    location: string | null;
    dateLabel: string;
    sov: number | null;
    bestRank: number | null;
  }[];
};

const QUICK_TOOLS = [
  {
    title: "Review Link & QR",
    href: (id: string) => `/businesses/${id}/reputation/qr-campaigns`,
    icon: QrCode,
    cta: "Get Link",
    locked: false,
  },
  {
    title: "AI Review Reply",
    href: () => "/tools/review-response-generator",
    icon: MessageSquareText,
    cta: "Write Reply",
    locked: false,
  },
  {
    title: "Review Widget",
    href: () => "/tools/google-review-widget",
    icon: Star,
    cta: "Get Widget",
    locked: false,
  },
  {
    title: "Maps Spot Check",
    href: () => "/tools/google-maps-rank-checker",
    icon: Grid3X3,
    cta: "Check Rank",
    locked: false,
  },
  {
    title: "Local Maps Rank",
    href: (id: string) => `/businesses/${id}/scans`,
    icon: Grid3X3,
    cta: "Scan Now",
    locked: false,
  },
  {
    title: "Health Assessment",
    href: (id: string) => `/businesses/${id}/local-seo-health`,
    icon: FileSearch,
    cta: "Run Assessment",
    locked: false,
  },
] as const;

export function TrialDashboard({
  businessId,
  businessName,
  userName,
  rating,
  reviewCount,
  creditsUsed = 0,
  creditsLimit = 100,
  recentScans = [],
}: TrialDashboardProps) {
  const first = (userName || "there").split(" ")[0];
  const creditPct = Math.min(100, Math.round((creditsUsed / Math.max(1, creditsLimit)) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#137752]">
            Free trial
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">
            Welcome back, {first}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            {businessName} · Trial dashboard for free tools, Maps credits, and your health assessment.
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/local-seo-health`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#137752] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(19,119,82,0.28)]"
        >
          Run Health Assessment
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Average Rating", value: rating != null ? rating.toFixed(1) : "—" },
          { label: "Google Rating", value: rating != null ? rating.toFixed(1) : "—" },
          { label: "Total Reviews", value: reviewCount != null ? String(reviewCount) : "0" },
          { label: "Negative", value: "—" },
          { label: "Positive", value: "—" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#E6EAF0] bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#0B1220]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(16rem,20rem)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#0B1220]">Recent grid scans</h2>
              <Link
                href={`/businesses/${businessId}/scans`}
                className="text-[12px] font-bold text-[#137752] hover:underline"
              >
                New scan
              </Link>
            </div>
            {recentScans.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-[#667085]">
                    <tr>
                      <th className="pb-2 font-bold">Search term</th>
                      <th className="pb-2 font-bold">Location</th>
                      <th className="pb-2 font-bold">Date</th>
                      <th className="pb-2 font-bold">SoV</th>
                      <th className="pb-2 font-bold">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.slice(0, 5).map((row) => (
                      <tr key={row.id} className="border-t border-[#F2F4F7]">
                        <td className="py-2.5 font-semibold text-[#0B1220]">{row.keyword}</td>
                        <td className="py-2.5 text-[#667085]">{row.location || "—"}</td>
                        <td className="py-2.5 text-[#667085]">{row.dateLabel}</td>
                        <td className="py-2.5 font-bold text-[#137752]">
                          {row.sov != null ? `${row.sov}%` : "—"}
                        </td>
                        <td className="py-2.5 font-bold text-[#0B1220]">
                          {row.bestRank != null ? `#${row.bestRank}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[#344054]">No grid scans yet</p>
                <p className="mt-1 text-[12px] text-[#667085]">
                  Use trial credits to scan rankings across your service area.
                </p>
                <Link
                  href={`/businesses/${businessId}/scans`}
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-[#137752] px-4 text-sm font-bold text-white"
                >
                  Run your first scan
                </Link>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-extrabold text-[#0B1220]">Quick access tools</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                const href = tool.href(businessId);
                return (
                  <Link
                    key={tool.title}
                    href={href}
                    className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm transition hover:border-[#137752]/40"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#137752]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-[#0B1220]">{tool.title}</p>
                    <span className="mt-2 inline-flex text-[12px] font-bold text-[#137752]">
                      {tool.cta} →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Usage</p>
            <p className="mt-2 text-lg font-extrabold text-[#0B1220]">
              {creditsUsed}/{creditsLimit} credits used
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6EAF0]">
              <div className="h-full rounded-full bg-[#137752]" style={{ width: `${creditPct}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-[#667085]">Credits power Maps grid scans during your trial.</p>
            <Link
              href="/settings/subscription"
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#137752] text-sm font-bold text-white"
            >
              Add top-up / upgrade
            </Link>
          </div>

          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
              Included in trial
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#344054]">
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#137752]" /> Free tools (reply, widget, spot check)
              </li>
              <li className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#137752]" /> Review link &amp; QR
              </li>
              <li className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-[#137752]" /> Maps scans with trial credits
              </li>
              <li className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-[#137752]" /> Local SEO Health Assessment
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[#FEC84B]/50 bg-[#FFFAEB] p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-[#B54708]">
              <Lock className="h-4 w-4" /> Locked until you upgrade
            </p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-[#667085]">
              <li className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" /> Complete Local SEO Audit &amp; Action Plan
              </li>
              <li className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" /> Review campaigns &amp; SMS automation
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5" /> Advanced reputation intelligence
              </li>
            </ul>
            <Link
              href="/settings/subscription"
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-[#FDB022] bg-white text-sm font-bold text-[#B54708]"
            >
              Unlock paid features
            </Link>
          </div>
        </aside>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white",
          "bg-gradient-to-br from-[#137752] to-[#0B4F36]"
        )}
      >
        <div>
          <p className="text-sm font-extrabold">Access everything with ease</p>
          <p className="mt-0.5 text-[12px] text-white/85">
            Upgrade to unlock the complete audit, campaigns, and advanced reports.
          </p>
        </div>
        <Link
          href="/settings/subscription"
          className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-extrabold text-[#137752]"
        >
          Start paid plan
        </Link>
      </div>
    </div>
  );
}
