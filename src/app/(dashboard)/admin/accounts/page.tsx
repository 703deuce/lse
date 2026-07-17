import { requirePlatformAdmin } from "@/lib/auth/admin";
import { AdminAccountsClient } from "@/components/admin/admin-accounts-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { redirect } from "next/navigation";

export default async function AdminAccountsPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return (
    <ModulePage>
      <ModuleHeader
        title="Admin — Accounts"
        subtitle="Manually switch customer packages and reset usage during beta."
      />
      <AdminAccountsClient />
    </ModulePage>
  );
}
