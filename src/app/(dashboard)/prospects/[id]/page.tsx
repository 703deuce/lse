import { requirePageAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { AccountDetail } from "@/components/accounts/account-detail";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  await requireBusinessAccess(id);
  return <AccountDetail businessId={id} mode="prospect" />;
}
