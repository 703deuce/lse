import { NextResponse } from "next/server";
import { publicToolCorsHeaders } from "@/lib/public/cors";

export const runtime = "nodejs";

/**
 * Anonymous free Local SEO Audit API retired — trial Health Assessment is the
 * product path. Keep the route so old clients get a clear upgrade response
 * instead of burning paid provider credits.
 */
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicToolCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = publicToolCorsHeaders(request.headers.get("origin"));
  return NextResponse.json(
    {
      error:
        "The anonymous free audit is no longer available. Start a free trial for a Local SEO Health Assessment, or upgrade for the Complete Local SEO Audit.",
      upgrade: "/sign-up?next=/local-seo-health",
    },
    { status: 410, headers }
  );
}
