import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { listClass } from "@/components/ui/design-system";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";

type ToolLocationPickerProps = {
  title: string;
  description: string;
  /** Path under `/businesses/{id}/…` (no leading slash). */
  businessPath: string;
  /** Label used in the open link, e.g. "Registration". */
  openLabel: string;
};

/**
 * Org-level location chooser used when a sidebar tool needs a businessId
 * but none is selected yet.
 */
export async function ToolLocationPicker({
  title,
  description,
  businessPath,
  openLabel,
}: ToolLocationPickerProps) {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);
  const path = businessPath.replace(/^\/+/, "");

  return (
    <>
      <PageHeader title={title} subtitle={description} />
      {!active.length ? (
        <ModuleEmptyState
          title="Add a location first"
          description="Choose a prospect or client so this tool has a business to work on."
          actionLabel="Add client"
          actionHref="/businesses/new?as=client"
        />
      ) : (
        <ul className={listClass}>
          {active.map((b) => {
            const isProspect =
              b.account_type === "prospect" || b.is_tracked === false;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {b.name}
                  </p>
                  <p className="text-xs capitalize text-zinc-500">
                    {isProspect ? "Prospect" : "Client"}
                  </p>
                </div>
                <Link
                  href={`/businesses/${b.id}/${path}`}
                  className="shrink-0 text-xs font-medium text-[#137752] hover:underline"
                >
                  Open {openLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
