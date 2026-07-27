import { redirect } from "next/navigation";

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  // Monthly Progress is not built yet — send users to the live overview instead of an empty shell.
  redirect(`/businesses/${businessId}/overview`);
}
