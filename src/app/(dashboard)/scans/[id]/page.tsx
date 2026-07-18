import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { requireScanAccess } from "@/lib/auth/api-auth";

export default async function ScanDetailAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  const access = await requireScanAccess(id);
  redirect(`/businesses/${access.businessId}/grid/${id}`);
}
