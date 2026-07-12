import { redirect } from "next/navigation";

export default async function Core30Redirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/growth-audit?tab=service-coverage`);
}
