import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { resolvePostLoginPath } from "@/lib/auth/home-path";

/** Legacy /businesses hub → Workspace (or Get started on first login). */
export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requirePageAuth();
  const { error } = await searchParams;
  // Keep error query when sending people to Clients for access issues.
  if (error) {
    redirect(`/clients?error=${encodeURIComponent(error)}`);
  }
  redirect(await resolvePostLoginPath(auth.organizationId));
}
