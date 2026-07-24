import { redirect } from "next/navigation";

export default async function ReviewSettingsRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/reputation/settings`);
}
