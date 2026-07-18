import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { WorkspaceQueue } from "@/components/dashboard/workspace-queue";
import { loadWorkingQueue } from "@/lib/workspace/working-queue";

/** Org workspace queue — scans due, reports due, prospect follow-ups. Not the location dashboard. */
export default async function WorkspacePage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const [{ data: org }, queue] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", auth.organizationId).maybeSingle(),
    loadWorkingQueue(supabase, auth.organizationId),
  ]);

  return (
    <WorkspaceQueue queue={queue} orgName={(org?.name as string | null) ?? null} />
  );
}
