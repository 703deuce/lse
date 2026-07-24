import { redirect } from "next/navigation";
import { ReputationSetupWizard } from "@/components/onboarding/reputation-setup-wizard";
import { requirePageAuth } from "@/lib/auth/context";
import {
  loadBusinessLifecycleState,
  loadPrimaryBusinessId,
  orgHasBusinesses,
} from "@/lib/workflow/lifecycle";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const auth = await requirePageAuth();

  let businessId = sp.businessId ?? null;
  if (!businessId) {
    const hasBiz = await orgHasBusinesses(auth.organizationId);
    if (hasBiz) {
      businessId = await loadPrimaryBusinessId(auth.organizationId);
    }
  }

  if (businessId) {
    const state = await loadBusinessLifecycleState(businessId);
    if (state && state.phase !== "needs_onboarding") {
      redirect(`/businesses/${businessId}/reputation/overview`);
    }
  }

  return <ReputationSetupWizard initialBusinessId={businessId} />;
}
