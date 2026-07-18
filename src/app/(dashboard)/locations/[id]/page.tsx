import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

/** Location detail → client or prospect detail (same business row). */
export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  await requireBusinessAccess(id);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("account_type, is_tracked")
    .eq("id", id)
    .maybeSingle();

  if (data?.account_type === "prospect" || data?.is_tracked === false) {
    redirect(`/prospects/${id}`);
  }
  redirect(`/clients/${id}`);
}
