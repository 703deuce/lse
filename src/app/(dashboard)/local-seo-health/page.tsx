import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

/** Soft entry: land on the first business health assessment after trial signup. */
export default async function LocalSeoHealthEntryPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.id) {
    redirect("/onboarding?next=/local-seo-health");
  }
  redirect(`/businesses/${data.id}/local-seo-health`);
}
