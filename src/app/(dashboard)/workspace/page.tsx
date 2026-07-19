import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { resolvePostLoginPath } from "@/lib/auth/home-path";
import { OrgJourneyHome } from "@/components/journey/org-journey-home";

/**
 * Workspace = org home (clients, prospects, queue, next actions).
 * First login (no locations) still goes to Get started.
 */
export default async function WorkspacePage() {
  const auth = await requirePageAuth();
  const home = await resolvePostLoginPath(auth.organizationId);
  if (home === "/onboarding") {
    redirect("/onboarding");
  }

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", auth.organizationId)
    .maybeSingle();

  return <OrgJourneyHome orgName={(org?.name as string | null) ?? null} />;
}
