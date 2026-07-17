import { NextResponse } from "next/server";

/** Map auth/access exceptions to safe HTTP responses (no stack/provider leakage). */
export function httpErrorFromException(
  err: unknown,
  fallbackMessage = "Request could not be completed"
): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  const lower = message.toLowerCase();

  if (code === "reauth_required" || lower.includes("reauthentication required")) {
    return NextResponse.json(
      { error: "Reauthentication required", code: "reauth_required" },
      { status: 401 }
    );
  }

  if (code === "mfa_required" || lower.includes("mfa required")) {
    return NextResponse.json(
      { error: "MFA required", code: "mfa_required" },
      { status: 401 }
    );
  }

  if (
    lower.includes("authentication required") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthorized")
  ) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (lower.includes("admin access required")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (
    lower.includes("access denied") ||
    lower.includes("not found or access denied") ||
    lower.includes("forbidden")
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (lower.includes("not found")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lower.includes("too many") || lower.includes("rate limit")) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
