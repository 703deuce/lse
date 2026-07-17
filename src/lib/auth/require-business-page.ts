import { redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireAuth } from "@/lib/auth/context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server guard for business-scoped dashboard pages.
 * Ensures the user is authenticated and belongs to the business tenant.
 *
 * Access failures redirect to /businesses (with a query flag) instead of a blank
 * Next.js 404 — that looked like "the button is broken" for sidebar modules.
 */
export async function requireBusinessPage(businessId: string): Promise<{
  userId: string;
  organizationId: string;
}> {
  if (!UUID_RE.test(businessId)) {
    redirect("/businesses?error=invalid_business");
  }

  try {
    await requireAuth();
    return await requireBusinessAccess(businessId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("authentication required")) {
      redirect("/sign-in");
    }
    redirect("/businesses?error=access_denied");
  }
}
