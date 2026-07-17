import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAuth();
  const supabase = createServiceClient();
  const { error } = await searchParams;

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  const accessMessage =
    error === "access_denied"
      ? "You do not have access to that business. Pick one of your businesses below."
      : error === "invalid_business"
        ? "That business link was invalid. Pick one of your businesses below."
        : null;

  return (
    <>
      <PageHeader
        title="Your businesses"
        subtitle="Audit Maps visibility and get weekly action plans"
        actions={
          <Link
            href="/businesses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add business
          </Link>
        }
      />

      {accessMessage ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {accessMessage}
        </div>
      ) : null}

      {!businesses?.length ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <MapPin className="mx-auto h-10 w-10 text-zinc-400" />
          <h2 className="mt-4 text-lg font-medium">No businesses yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Add your first location to run a grid scan and get an action plan.
          </p>
          <Link
            href="/businesses/new"
            className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Get started
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/businesses/${b.id}/overview`}
              className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-emerald-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <h3 className="font-semibold text-zinc-900">{b.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{b.address_text ?? b.primary_category ?? "—"}</p>
              {b.primary_category && (
                <span className="mt-3 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {b.primary_category}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
