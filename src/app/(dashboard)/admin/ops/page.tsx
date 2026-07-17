import { requirePlatformAdmin } from "@/lib/auth/admin";
import { AdminOpsClient } from "@/components/admin/admin-ops-client";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { redirect } from "next/navigation";

export default async function AdminOpsPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

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
