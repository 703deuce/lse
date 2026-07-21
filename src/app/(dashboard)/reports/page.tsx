import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { ModulePage } from "@/components/ui/design-system";
import { OrgReportsHome } from "@/components/reports/org-reports-home";

export default async function ReportsIndexPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);

  return (
    <ModulePage>
      <OrgReportsHome businesses={active} />
    </ModulePage>
  );
}
