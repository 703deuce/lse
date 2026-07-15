import { createServiceClient } from "@/lib/db/client";
import { notFound } from "next/navigation";

export default async function ShareReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: report } = await supabase
    .from("reports")
    .select("html_content, share_expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!report?.html_content) notFound();

  if (report.share_expires_at) {
    const expires = new Date(report.share_expires_at).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) notFound();
  }

  // Isolate full report document in an iframe so nested <html> never breaks the app shell.
  return (
    <iframe
      title="Shared report"
      className="h-dvh w-full border-0 bg-white"
      srcDoc={report.html_content}
    />
  );
}
