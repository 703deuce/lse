import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { WorkingQueueDashboard } from "@/components/dashboard/working-queue";
import { loadWorkingQueue } from "@/lib/workspace/working-queue";

/** Org working queue for solo local SEO consultants. */
export default async function DashboardPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const [{ data: org }, queue] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", auth.organizationId).maybeSingle(),
    loadWorkingQueue(supabase, auth.organizationId),
  ]);

  return (
    <WorkingQueueDashboard queue={queue} orgName={(org?.name as string | null) ?? null} />
  );
}
