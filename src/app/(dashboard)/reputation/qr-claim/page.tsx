import { Suspense } from "react";
import { requirePageAuth } from "@/lib/auth/context";
import { QrClaimClient } from "@/components/reputation/qr-campaigns/qr-claim-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";

export default async function QrClaimPage() {
  await requirePageAuth();
  return (
    <ModulePage>
      <ModuleHeader
        title="Save your QR campaign"
        subtitle="Attach the poster you created to a business so you can track scans."
      />
      <Suspense fallback={<p className="text-sm text-[#667085]">Loading…</p>}>
        <QrClaimClient />
      </Suspense>
    </ModulePage>
  );
}
