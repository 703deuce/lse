import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requireBusinessPageData(businessId);

  return <SettingsClient businessId={businessId} business={business} />;
}
