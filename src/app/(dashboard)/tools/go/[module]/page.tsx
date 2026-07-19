import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import {
  isLocationToolSlug,
  LOCATION_TOOL_MODULES,
} from "@/lib/dashboard/tool-modules";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";

export default async function ToolLocationPickerPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  if (!isLocationToolSlug(slug)) notFound();

  const mod = LOCATION_TOOL_MODULES[slug];
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, account_type, is_tracked, archived_at")
    .eq("organization_id", auth.organizationId)
    .order("name");

  const active = (businesses ?? []).filter((b) => !b.archived_at);

  return (
    <>
      <PageHeader title={mod.title} subtitle={mod.description} />
      {!active.length ? (
        <ModuleEmptyState
          title="Add a location first"
          description="Choose a prospect or client so this tool has a business to work on."
          actionLabel="Add client"
          actionHref="/businesses/new?as=client"
        />
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {active.map((b) => {
            const isProspect =
              b.account_type === "prospect" || b.is_tracked === false;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{b.name}</p>
                  <p className="text-xs capitalize text-zinc-500">
                    {isProspect ? "Prospect" : "Client"}
                  </p>
                </div>
                <Link
                  href={`/businesses/${b.id}/${mod.path}`}
                  className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                >
                  Open {mod.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
