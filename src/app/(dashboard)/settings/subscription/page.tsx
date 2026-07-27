import { requirePageAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/page-header";
import { AccountPlanUsageCard } from "@/components/settings/account-plan-usage-card";

const UPGRADE_COPY: Record<string, string> = {
  campaigns: "Review campaigns and SMS automation",
  keywords: "Scheduled keyword tracking campaigns",
  "complete-audit": "Complete Local SEO Audit & Action Plan",
  messaging: "Dedicated messaging and SMS automation",
};

export default async function SubscriptionSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ upgrade?: string }>;
}) {
  await requirePageAuth();
  const params = (await searchParams) ?? {};
  const upgradeKey = params.upgrade?.trim() || "";
  const upgradeLabel = upgradeKey ? UPGRADE_COPY[upgradeKey] ?? "This paid feature" : null;

  return (
    <>
      <PageHeader
        title="Subscription"
        subtitle="Manual Maps scans are unlimited. Capacity is controlled by active locations and concurrent scans."
      />
      {upgradeLabel ? (
        <div className="mb-4 rounded-2xl border border-[#FEC84B]/60 bg-[#FFFAEB] px-4 py-3">
          <p className="text-sm font-extrabold text-[#B54708]">
            {upgradeLabel} is locked on your trial
          </p>
          <p className="mt-1 text-[13px] text-[#667085]">
            Free tools, Maps scans with credits, QR links, and your Health Assessment stay available.
            Upgrade to unlock paid features and higher limits.
          </p>
        </div>
      ) : null}
      <AccountPlanUsageCard />
    </>
  );
}
