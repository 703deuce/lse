import { redirect } from "next/navigation";

export default async function ReputationIndexPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/reputation/overview`);
}
