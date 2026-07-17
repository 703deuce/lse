import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { getBusiness } from "@/lib/db/queries";

export async function BusinessModuleShell({
  businessId,
  title,
  subtitle,
  children,
}: {
  businessId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // Redirect on auth/access failures — do not throw or notFound().
  // Throwing "Authentication required" after a flaky org-gate lookup used to
  // render Next's dead "page cannot load / reload" state while workers kept going.
  const auth = await requireBusinessPage(businessId);
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) redirect("/businesses?error=access_denied");

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link
            href={`/businesses/${businessId}/workspace`}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            ← Maps Workspace
          </Link>
        }
      />
      {children}
    </>
  );
}
