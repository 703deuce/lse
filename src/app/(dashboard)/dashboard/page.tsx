import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { OrgJourneyHome } from "@/components/journey/org-journey-home";

/**
 * Org dashboard = journey home (what is happening / what needs attention / what next).
 * Location overview remains at /businesses/[id]/overview.
 */
export default async function DashboardPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", auth.organizationId)
    .maybeSingle();

  return <OrgJourneyHome orgName={(org?.name as string | null) ?? null} />;
}
