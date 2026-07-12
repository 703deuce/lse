import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow } from "@/lib/db/types";
import Link from "next/link";

export default async function AgencyClientsPage() {
  const auth = await requireAuth();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const businesses = (data ?? []) as BusinessRow[];

  return (
    <>
      <PageHeader
        title="Agency — Clients"
        subtitle="Multi-location management (owner workspace for now)"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="pb-3 pr-4 font-medium">Business</th>
              <th className="pb-3 pr-4 font-medium">Category</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-zinc-100">
                <td className="py-3 pr-4 font-medium">{b.name}</td>
                <td className="py-3 pr-4">{b.primary_category ?? "—"}</td>
                <td className="py-3">
                  <Link href={`/businesses/${b.id}/overview`} className="text-emerald-600 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!businesses.length && <p className="mt-4 text-zinc-500">No clients yet.</p>}
      </div>
    </>
  );
}
