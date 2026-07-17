import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { isAllowedExternalRedirect } from "@/lib/security/safe-redirect";
import { consumeGoogleOAuthState } from "@/lib/integrations/google-oauth-cookies";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const url = new URL(request.url);
    const redirect = url.searchParams.get("redirect") ?? url.searchParams.get("returnTo");
    if (redirect && !isAllowedExternalRedirect(redirect)) {
      return NextResponse.json({ error: "Invalid redirect target" }, { status: 400 });
    }

    const stateParam = url.searchParams.get("state");
    const oauth = await consumeGoogleOAuthState(stateParam);
    if (!oauth.ok) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    return NextResponse.json(
      {
        status: "not_configured",
        message: "Google OAuth requires Firebase auth + GCP Business Profile API approval.",
        pkceReady: Boolean(oauth.codeVerifier),
      },
      { status: 501 }
    );
  } catch (err) {
    return httpErrorFromException(err);
  }
}
