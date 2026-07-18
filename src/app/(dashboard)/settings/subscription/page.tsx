import { requirePageAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/page-header";
import { AccountPlanUsageCard } from "@/components/settings/account-plan-usage-card";

export default async function SubscriptionSettingsPage() {
  await requirePageAuth();
  return (
    <>
      <PageHeader
        title="Subscription"
        subtitle="Manual Maps scans are unlimited. Capacity is controlled by active locations and concurrent scans."
      />
      <AccountPlanUsageCard />
    </>
  );
}
