import { notFound, redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireAuth } from "@/lib/auth/context";

/**
 * Server guard for business-scoped dashboard pages.
 * Ensures the user is authenticated and belongs to the business tenant.
 */
export async function requireBusinessPage(businessId: string): Promise<{
  userId: string;
  organizationId: string;
}> {
  try {
    await requireAuth();
    return await requireBusinessAccess(businessId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("authentication required")) {
      redirect("/sign-in");
    }
    notFound();
  }
}
