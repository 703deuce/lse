import { createServiceClient } from "@/lib/db/client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Stop infinite refresh if the report worker never finishes. */
const GENERATING_TIMEOUT_MS = 10 * 60 * 1000;

export default async function ShareReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const supabase = createServiceClient();

  const { data: report } = await supabase
    .from("reports")
    .select(
      "html_content, share_expires_at, artifact_status, error_message, business_id, generated_at"
    )
    .eq("share_token", token)
    .maybeSingle();

  // Revoked / unknown token — never leak existence details.
  if (!report) notFound();

  if (report.share_expires_at) {
    const expires = new Date(report.share_expires_at).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) notFound();
  }

  const status = String(report.artifact_status ?? "ready");
  const generatedAt = report.generated_at ? new Date(report.generated_at as string).getTime() : NaN;
  const generatingTooLong =
    Number.isFinite(generatedAt) && Date.now() - generatedAt > GENERATING_TIMEOUT_MS;

  if (!report.html_content) {
    if (status === "failed" || generatingTooLong) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
          <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-zinc-900">Report unavailable</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {status === "failed"
                ? "Generation failed. Ask the sender to create the shareable report again."
                : "Generation timed out. Ask the sender to create the shareable report again."}
            </p>
          </div>
        </main>
      );
    }

    // Generating — auto-refresh until HTML is ready (capped by GENERATING_TIMEOUT_MS).
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Creating report…</h1>
          <p className="mt-2 text-sm text-zinc-600">
            This usually takes under a minute. This page refreshes automatically.
          </p>
          <meta httpEquiv="refresh" content="3" />
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function(){location.reload()},3000)`,
            }}
          />
        </div>
      </main>
    );
  }

  // Isolate full report document in an iframe so nested <html> never breaks the app shell.
  return (
    <iframe
      title="Shared report"
      className="h-dvh w-full border-0 bg-white"
      srcDoc={report.html_content}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
