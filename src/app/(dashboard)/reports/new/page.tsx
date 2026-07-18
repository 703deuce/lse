import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

/** Canonical “new report” entry — routes into the per-location Reports hub. */
export default async function ReportsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const auth = await requirePageAuth();
  const { businessId } = await searchParams;
  if (businessId) {
    redirect(`/businesses/${businessId}/reports`);
  }

  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (businesses?.[0]?.id) {
    redirect(`/businesses/${businesses[0].id}/reports`);
  }
  redirect("/reports");
}
