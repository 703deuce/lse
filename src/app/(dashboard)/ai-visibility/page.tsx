import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { emptyStateClass, listClass } from "@/components/ui/design-system";

export default async function AiVisibilityIndexPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, archived_at, account_type")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);

  return (
    <>
      <PageHeader
        title="AI Visibility"
        subtitle="Optional mention tracking for client reports. Maps scans stay unlimited."
      />
      {!active.length ? (
        <div className={emptyStateClass}>
          <h2 className="text-base font-semibold text-zinc-900">No locations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Add a client or prospect before running AI visibility prompts.
          </p>
        </div>
      ) : (
        <ul className={listClass}>
          {active.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900">{b.name}</p>
              <Link
                href={`/businesses/${b.id}/ai-visibility`}
                className="text-xs font-medium text-[#137752] hover:underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
