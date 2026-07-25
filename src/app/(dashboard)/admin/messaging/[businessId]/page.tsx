import { requirePlatformAdmin } from "@/lib/auth/admin";
import { AdminMessagingDetail } from "@/components/messaging/admin-messaging-detail";
import { ModulePage } from "@/components/ui/design-system";
import { redirect } from "next/navigation";

export default async function AdminMessagingDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }
  const { businessId } = await params;

  return (
    <ModulePage wide>
      <AdminMessagingDetail businessId={businessId} />
    </ModulePage>
  );
}
