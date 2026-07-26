import { requirePlatformAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { AdminQrCampaignsClient } from "@/components/reputation/qr-campaigns/admin-qr-campaigns-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";

export default async function AdminQrCampaignsPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/workspace");
  }

  return (
    <ModulePage>
      <ModuleHeader
        title="QR Campaigns (Admin)"
        subtitle="Search campaigns, inspect destinations, and pause abusive links."
      />
      <AdminQrCampaignsClient />
    </ModulePage>
  );
}
