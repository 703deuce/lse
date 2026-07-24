"use client";

import { ReputationSetupWizard } from "@/components/onboarding/reputation-setup-wizard";

export default function WorkflowReputationSetupPreview() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
      <ReputationSetupWizard initialBusinessId={null} />
    </div>
  );
}
