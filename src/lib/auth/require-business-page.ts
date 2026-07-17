import { redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getAuthContext } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server guard for business-scoped dashboard pages.
 * Always redirects on failure — never throws. Uncaught throws become Next's
 * builtin "This page couldn’t load / Reload to try again, or go back".
 */
export async function requireBusinessPage(businessId: string): Promise<{
  userId: string;
  organizationId: string;
  email: string | null;
}> {
  if (!UUID_RE.test(businessId)) {
    redirect("/businesses?error=invalid_business");
  }

  const auth = await getAuthContext();
  if (!auth.isAuthenticated) {
    redirect("/sign-in");
  }

  try {
    const access = await requireBusinessAccess(businessId);
    return { ...access, email: auth.email };
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("authentication required")) {
      redirect("/sign-in");
    }
    redirect("/businesses?error=access_denied");
  }
}

/**
 * Page helper: auth + tenant business row, or redirect (never notFound/throw).
 */
export async function requireBusinessPageData(businessId: string): Promise<{
  userId: string;
  organizationId: string;
  email: string | null;
  business: NonNullable<Awaited<ReturnType<typeof getBusiness>>>;
}> {
  const auth = await requireBusinessPage(businessId);
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) {
    redirect("/businesses?error=access_denied");
  }
  return { ...auth, business };
}
