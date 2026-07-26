import { NextResponse } from "next/server";
import {
  agentScreenshotSecretMatches,
  getAgentScreenshotEmail,
  isAgentScreenshotConfigured,
} from "@/lib/auth/agent-screenshot";
import { ensureUserOrganization } from "@/lib/auth/onboarding";
import { isSoftHomePath, resolvePostLoginPath } from "@/lib/auth/home-path";
import { getAppBaseUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/request-id";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  return raw;
}

/**
 * GET /auth/agent?token=AGENT_SCREENSHOT_SECRET&next=/workspace
 *
 * Mints a real Supabase session for AGENT_SCREENSHOT_EMAIL so automation can
 * screenshot the live app (real user chrome), not the Dev User bypass.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const { searchParams, origin } = new URL(request.url);
  const notFound = () => {
    const res = new NextResponse(null, { status: 404 });
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  };

  if (!isAgentScreenshotConfigured()) {
    return notFound();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rate = await assertRateLimit({
    key: `auth:agent:${ip}`,
    maxPerWindow: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    const denied = new NextResponse("Too many requests", { status: 429 });
    denied.headers.set(REQUEST_ID_HEADER, requestId);
    denied.headers.set("Retry-After", String(Math.ceil(rate.retryAfterMs / 1000)));
    return denied;
  }

  const token = searchParams.get("token");
  if (!agentScreenshotSecretMatches(token)) {
    logger.warn("agent_screenshot_login_rejected", { requestId, reason: "bad_token" });
    return notFound();
  }

  const email = getAgentScreenshotEmail();
  if (!email) return notFound();

  let hashedToken: string;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data?.properties?.hashed_token) {
      logger.warn("agent_screenshot_generate_link_failed", {
        requestId,
        message: error?.message ?? "missing_hashed_token",
      });
      return notFound();
    }
    hashedToken = data.properties.hashed_token;
  } catch (err) {
    logger.warn("agent_screenshot_generate_link_error", {
      requestId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return notFound();
  }

  const supabase = await createClient();
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });

  if (verifyError || !verified.user) {
    logger.warn("agent_screenshot_verify_failed", {
      requestId,
      message: verifyError?.message ?? "no_user",
    });
    return notFound();
  }

  const requestedNext = safeNextPath(searchParams.get("next"));
  const organizationId = await ensureUserOrganization(verified.user);
  let next =
    requestedNext && !isSoftHomePath(requestedNext) ? requestedNext : null;
  if (!next) {
    next = await resolvePostLoginPath(organizationId);
  }

  const base =
    process.env.NODE_ENV === "production" ? getAppBaseUrl() : origin;
  const redirect = NextResponse.redirect(`${base}${next ?? "/workspace"}`);
  redirect.headers.set(REQUEST_ID_HEADER, requestId);
  logger.info("agent_screenshot_login_ok", {
    requestId,
    email,
    userId: verified.user.id,
  });
  return redirect;
}
