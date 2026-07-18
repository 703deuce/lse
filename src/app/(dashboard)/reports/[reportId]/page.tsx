import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { notFound } from "next/navigation";

/** Open a saved report in the business Reports hub (share controls live there). */
export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requirePageAuth();
  const { reportId } = await params;
  const supabase = createServiceClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, business_id, share_token")
    .eq("id", reportId)
    .maybeSingle();
  if (!report?.business_id) notFound();
  if (report.share_token) {
    redirect(`/reports/share/${report.share_token}`);
  }
  redirect(`/businesses/${report.business_id}/reports`);
}
