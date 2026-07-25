import { requirePlatformAdmin } from "@/lib/auth/admin";
import { AdminMessagingList } from "@/components/messaging/admin-messaging-list";
import { ModulePage } from "@/components/ui/design-system";
import { redirect } from "next/navigation";

export default async function AdminMessagingPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return (
    <ModulePage wide>
      <AdminMessagingList />
    </ModulePage>
  );
}
