import { redirect } from "next/navigation";

export default async function AuditRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/growth-audit?tab=gbp`);
}
