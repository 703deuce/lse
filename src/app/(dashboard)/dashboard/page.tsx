import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

/**
 * Dashboard → first active client overview (the real per-location dashboard).
 * Org working queue lives at /workspace — not here.
 */
export default async function DashboardPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, is_tracked, account_type, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const active = (data ?? []).find(
    (b) =>
      !b.archived_at &&
      b.is_tracked !== false &&
      (b.account_type === "client" || b.account_type == null)
  );

  if (active?.id) {
    redirect(`/businesses/${active.id}/overview`);
  }
  redirect("/clients");
}
