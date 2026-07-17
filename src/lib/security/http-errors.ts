import { NextResponse } from "next/server";
import { EntitlementError } from "@/lib/auth/entitlements";
import { OrganizationEnqueueError } from "@/lib/auth/org-status";
import { PlanLimitError } from "@/lib/plans";

/** Structured 402/403 for plan limits and entitlements — never leak provider/DB internals. */
export function httpEntitlementError(err: unknown): NextResponse | null {
  if (err instanceof PlanLimitError) {
    return NextResponse.json(
      { error: err.message, limitKey: err.limitKey },
      { status: 402 }
    );
  }
  if (err instanceof EntitlementError) {
    return NextResponse.json(
      { error: err.message, entitlement: err.entitlement },
      { status: 403 }
    );
  }
  return null;
}

/** Map auth/access exceptions to safe HTTP responses (no stack/provider leakage). */
export function httpErrorFromException(
  err: unknown,
  fallbackMessage = "Request could not be completed"
): NextResponse {
  const entitlement = httpEntitlementError(err);
  if (entitlement) return entitlement;

  if (err instanceof OrganizationEnqueueError) {
    if (err.code === "org_lookup_failed") {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 }
    );
  }

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

  // Keep true resource-misses as 404, but never map org/queue gate failures
  // ("Organization not found") — those were breaking every module Run button.
  if (
    lower.includes("not found") &&
    !lower.includes("organization") &&
    !lower.includes("could not verify organization")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lower.includes("too many") || lower.includes("rate limit")) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
