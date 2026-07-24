import { ReputationSetupWizard } from "@/components/onboarding/reputation-setup-wizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  return <ReputationSetupWizard initialBusinessId={sp.businessId ?? null} />;
}
