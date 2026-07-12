import { redirect } from "next/navigation";

export default async function HyperlocalRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/growth-audit?tab=local-coverage`);
}
