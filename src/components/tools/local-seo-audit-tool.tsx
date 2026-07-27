"use client";

import Link from "next/link";
import { FreeToolShell, freeToolPrimaryBtnClass } from "@/components/tools/free-tool-shell";
import { cn } from "@/lib/utils";

/**
 * Public free-tool surface for Local SEO Audit.
 * Anonymous reports are not offered — the trial Health Assessment (prospect audit)
 * requires an account.
 */
export function LocalSeoAuditTool({ embed = false }: { embed?: boolean }) {
  return (
    <FreeToolShell
      embed={embed}
      title="Local SEO Health Assessment"
      subtitle="Discover the most important problems affecting your local visibility. Start a free trial to run the assessment — the complete audit and fix plan stay on paid plans."
      steps={[
        { label: "Create your free trial" },
        { label: "Confirm business + keyword" },
        { label: "Run the health assessment" },
        { label: "Review findings" },
      ]}
      ctaHref="/sign-up?next=/local-seo-health"
      ctaLabel="Start free trial"
      footerNote="Your trial includes one Local SEO Health Assessment. Upgrade for the Complete Local SEO Audit and Action Plan."
    >
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#137752]">
              Trial assessment includes
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#344054]">
              <li>• Overall local SEO health score</li>
              <li>• Broad issue categories with evidence problems exist</li>
              <li>• Selected high-level findings</li>
              <li>• One keyword Maps visibility snapshot</li>
              <li>• Downloadable report for your own use</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#FEC84B]/60 bg-[#FFFAEB] p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#B54708]">
              Complete audit (paid)
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#344054]">
              <li>• Every failed check with exact details</li>
              <li>• Full recommended fixes and prioritized action plan</li>
              <li>• Website/local signals, competitors, monitoring</li>
            </ul>
          </div>
          <Link
            href="/sign-up?next=/local-seo-health"
            className={cn(freeToolPrimaryBtnClass, "w-full sm:w-auto")}
          >
            Start free trial &amp; run assessment
          </Link>
        </div>
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[#E6EAF0] bg-white p-6 text-center shadow-sm">
          <div className="relative mb-4 h-36 w-36">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
              <circle cx="64" cy="64" r="54" fill="none" stroke="#E6EAF0" strokeWidth="12" />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="#137752"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={339}
                strokeDashoffset={125}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-[#0B1220]">63</span>
              <span className="text-[10px] font-bold uppercase text-[#667085]">Sample</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-[#344054]">
            Same assessment SEO consultants use for prospects
          </p>
          <p className="mt-1 max-w-[28ch] text-[12px] text-[#667085]">
            Tuned for you as the business owner — not a client-share packet. No anonymous runs.
          </p>
        </div>
      </div>
    </FreeToolShell>
  );
}
