import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminOpsClient } from "@/components/admin/admin-ops-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { notFound } from "next/navigation";

export default async function AdminOpsPage() {
  const auth = await requireAuth();
  if (!isAdminEmail(auth.email)) notFound();

  return (
    <ModulePage wide>
      <ModuleHeader
        title="Admin — Ops"
        subtitle="Queue health, provider circuits, and job retry/cancel for internal operators."
      />
      <AdminOpsClient />
    </ModulePage>
  );
}
