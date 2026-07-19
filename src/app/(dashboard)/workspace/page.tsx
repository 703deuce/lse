import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { OrgJourneyHome } from "@/components/journey/org-journey-home";

/**
 * Workspace = org home (clients, prospects, queue, next actions).
 * Client Dashboard lives at /businesses/[id]/overview after you pick a location.
 */
export default async function WorkspacePage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", auth.organizationId)
    .maybeSingle();

  return <OrgJourneyHome orgName={(org?.name as string | null) ?? null} />;
}
