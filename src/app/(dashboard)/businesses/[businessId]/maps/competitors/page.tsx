import { redirect } from "next/navigation";

export default async function MapsCompetitorsRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/competitors`);
}
