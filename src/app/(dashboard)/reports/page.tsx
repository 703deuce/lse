import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { OrgReportsHome } from "@/components/reports/org-reports-home";
import { mock } from "@/components/mockup/ui";
import { FileText } from "lucide-react";

export default async function ReportsIndexPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at, address")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? [])
    .filter((b) => !b.archived_at)
    .map((b) => ({
      id: b.id,
      name: b.name,
      account_type: b.account_type,
      is_tracked: b.is_tracked,
      address: (b as { address?: string | null }).address ?? null,
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className={mock.title}>Reports</h1>
          <p className={mock.subtitle}>
            A list of reports that are currently available for your organization — some of the
            cards below are still in development.
          </p>
        </div>
      </div>
      <OrgReportsHome businesses={active} />
    </div>
  );
}
