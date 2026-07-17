import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { getBusinessKeywords } from "@/lib/db/queries";
import { MapsAuditWorkspace } from "@/components/workspace/maps-audit-workspace";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requireBusinessPageData(businessId);

  const keywords = await getBusinessKeywords(businessId);
  const primaryKw = keywords.find((k) => k.is_primary) ?? keywords[0];

  return (
    <>
      <div className="-mx-5 -mt-6 border-b border-zinc-200 px-6 py-4 lg:-mx-8">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Maps Audit Workspace</h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          {business.name} · {primaryKw?.keyword ?? "No keyword"} · GMB Everywhere-style audits inside your dashboard
        </p>
      </div>
      <MapsAuditWorkspace businessId={businessId} />
    </>
  );
}
