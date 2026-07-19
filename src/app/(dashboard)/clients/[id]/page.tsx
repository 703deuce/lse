import { Suspense } from "react";
import { requirePageAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { AccountDetail } from "@/components/accounts/account-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  await requireBusinessAccess(id);
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <AccountDetail businessId={id} mode="client" />
    </Suspense>
  );
}
