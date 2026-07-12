import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAccountsClient } from "@/components/admin/admin-accounts-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { notFound } from "next/navigation";

export default async function AdminAccountsPage() {
  const auth = await requireAuth();
  if (!isAdminEmail(auth.email)) notFound();

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
