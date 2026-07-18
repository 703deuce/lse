import { createServiceClient } from "@/lib/db/client";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hashShareToken } from "@/lib/reporting/share-token";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { writeSecurityAuditEvent } from "@/lib/security/audit-log";
import { headers, cookies } from "next/headers";
import { shareUnlockCookieName } from "@/lib/reporting/share-password";
import { trackProductEvent } from "@/lib/analytics/product-events";

export const dynamic = "force-dynamic";

/** Stop infinite refresh if the report worker never finishes. */
const GENERATING_TIMEOUT_MS = 10 * 60 * 1000;

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function ShareReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  if (!token || token.length < 16 || token.length > 128) notFound();

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";
  const rate = await assertRateLimit({
    key: `share:${ip}`,
    maxPerWindow: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
        <p className="text-sm text-zinc-600">Too many requests. Try again shortly.</p>
      </main>
    );
  }

  const supabase = createServiceClient();
  const tokenHash = hashShareToken(token);

  // Prefer hash lookup; fall back to legacy plaintext only when hash column is null.
  let { data: report } = await supabase
    .from("reports")
    .select(
      "id, html_content, share_expires_at, artifact_status, error_message, business_id, generated_at, share_token_hash, share_password_hash, publish_status, share_view_count"
    )
    .eq("share_token_hash", tokenHash)
    .maybeSingle();

  if (!report) {
    const legacy = await supabase
      .from("reports")
      .select(
        "id, html_content, share_expires_at, artifact_status, error_message, business_id, generated_at, share_token_hash, share_password_hash, publish_status, share_view_count"
      )
      .eq("share_token", token)
      .is("share_token_hash", null)
      .maybeSingle();
    report = legacy.data;
  }

  if (!report) notFound();

  if (report.publish_status === "archived" || report.publish_status === "draft") {
    notFound();
  }

  if (report.share_expires_at) {
    const expires = new Date(report.share_expires_at).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) notFound();
  }

  void (async () => {
    try {
      const { data: biz } = await supabase
        .from("businesses")
        .select("organization_id")
        .eq("id", report!.business_id)
        .maybeSingle();
      await writeSecurityAuditEvent({
        action: "report.share.view",
        organizationId: biz?.organization_id ?? null,
        resourceType: "report",
        resourceId: report!.id as string,
        ip,
        userAgent: hdrs.get("user-agent"),
      });
    } catch {
      /* best-effort */
    }
  })();

  const passwordHash = report.share_password_hash as string | null;
  if (passwordHash) {
    const hashForCookie = String(report.share_token_hash ?? tokenHash);
    const cookieStore = await cookies();
    const unlocked = cookieStore.get(
      shareUnlockCookieName(hashForCookie, passwordHash)
    );
    if (!unlocked?.value) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-zinc-900">Password required</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Enter the password provided with this shared report.
            </p>
            {query.error ? (
              <p className="mt-2 text-sm text-red-600">Incorrect password. Try again.</p>
            ) : null}
            <form
              method="post"
              action={`/reports/share/${token}/unlock`}
              className="mt-4 space-y-3"
            >
              <label className="block text-sm font-medium text-zinc-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
              >
                Unlock report
              </button>
            </form>
          </div>
        </main>
      );
    }
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
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Creating report…</h1>
          <p className="mt-2 text-sm text-zinc-600">
            This usually takes under a minute. This page refreshes automatically.
          </p>
          <meta httpEquiv="refresh" content="3" />
        </div>
      </main>
    );
  }

  // Count client views only — workspace members previewing their own link do not increment.
  void (async () => {
    try {
      const { data: biz } = await supabase
        .from("businesses")
        .select("organization_id")
        .eq("id", report.business_id)
        .maybeSingle();
      let skipCount = false;
      try {
        const userSb = await createUserClient();
        const {
          data: { user },
        } = await userSb.auth.getUser();
        if (user?.id && biz?.organization_id) {
          const { data: mem } = await supabase
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", biz.organization_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (mem) skipCount = true;
        }
      } catch {
        /* anonymous share viewers have no session */
      }
      if (!skipCount) {
        await supabase
          .from("reports")
          .update({
            share_view_count: (report.share_view_count ?? 0) + 1,
            share_last_viewed_at: new Date().toISOString(),
          })
          .eq("id", report.id);
        trackProductEvent("shared_report_viewed", {
          organizationId: biz?.organization_id ?? undefined,
          businessId: report.business_id as string,
          reportId: report.id as string,
        });
      }
    } catch {
      /* best-effort */
    }
  })();

  return (
    <iframe
      title="Shared report"
      className="h-dvh w-full border-0 bg-white"
      srcDoc={report.html_content}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  );
}
