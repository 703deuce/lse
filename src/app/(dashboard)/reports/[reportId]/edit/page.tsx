import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { notFound } from "next/navigation";

/** Edit entry — currently the Reports hub with share/summary controls. */
export default async function ReportEditPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requirePageAuth();
  const { reportId } = await params;
  const supabase = createServiceClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, business_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report?.business_id) notFound();
  try {
    await requireBusinessAccess(report.business_id as string);
  } catch {
    notFound();
  }
  redirect(`/businesses/${report.business_id}/reports`);
}
