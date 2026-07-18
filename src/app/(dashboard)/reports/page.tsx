import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReportsIndexPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);

  if (active.length === 1) {
    redirect(`/businesses/${active[0]!.id}/reports`);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Create branded prospect audits and monthly client reports from completed scans."
      />
      {!active.length ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-zinc-900">No reports yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Turn completed Maps and AI visibility scans into a branded client report.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {active.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{b.name}</p>
                <p className="text-xs capitalize text-zinc-500">
                  {b.account_type === "prospect" || b.is_tracked === false
                    ? "Prospect"
                    : "Client"}
                </p>
              </div>
              <Link
                href={`/businesses/${b.id}/reports`}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Open reports
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
