import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, emptyStateClass, listClass } from "@/components/ui/design-system";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";
import { isCancellableScanStatus } from "@/lib/scans/cancel-scan";
import {
  CancelActiveScansButton,
  CancelScanButton,
} from "@/components/scan/cancel-active-scans-button";

export default async function OrgScansPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", auth.organizationId);

  const ids = (businesses ?? []).map((b) => b.id as string);
  const nameById = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));

  const { data: scans } = ids.length
    ? await supabase
        .from("scan_batches")
        .select(
          "id, business_id, status, grid_size, radius_meters, created_at, finished_at, error_message, confidence_summary"
        )
        .in("business_id", ids)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as never[] };

  const hasActive = (scans ?? []).some((s) =>
    isCancellableScanStatus(String(s.status))
  );

  return (
    <>
      <PageHeader
        title="Scans"
        subtitle="Recent Maps grids across your prospects and clients."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasActive ? <CancelActiveScansButton /> : null}
            <Link href="/scans/new" className={btnPrimary}>
              New scan
            </Link>
          </div>
        }
      />

      {!scans?.length ? (
        <div className={emptyStateClass}>
          <h2 className="text-base font-semibold text-zinc-900">No scans yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Run a Maps scan for a prospect or client to track local rankings over time.
          </p>
          <Link
            href="/scans/new"
            className="mt-4 inline-block text-sm font-medium text-[#137752] hover:underline"
          >
            Start a scan
          </Link>
        </div>
      ) : (
        <ul className={listClass}>
          {scans.map((s) => {
            const conf = (s.confidence_summary ?? {}) as { keyword?: string; keyword_label?: string };
            const keyword = conf.keyword_label ?? conf.keyword ?? "—";
            const safeError = customerSafeScanError(s.error_message as string | null);
            return (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/businesses/${s.business_id}/grid/${s.id}`}
                    className="text-sm font-semibold text-zinc-900 hover:text-[#137752]"
                  >
                    {nameById.get(s.business_id as string) ?? "Location"} · {keyword}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {s.grid_size}×{s.grid_size} · {String(s.status)} ·{" "}
                    {new Date(s.created_at as string).toLocaleString()}
                  </p>
                  {safeError ? (
                    <p className="mt-1 text-xs text-amber-800">{safeError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isCancellableScanStatus(String(s.status)) ? (
                    <CancelScanButton scanId={String(s.id)} />
                  ) : null}
                  <Link
                    href={`/businesses/${s.business_id}/grid/${s.id}`}
                    className="text-xs font-medium text-[#137752] hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
