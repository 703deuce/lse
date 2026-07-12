import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

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
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

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
