import { requirePageAuth } from "@/lib/auth/context";
import { BusinessesHub } from "@/components/businesses/businesses-hub";

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageAuth();
  const { error } = await searchParams;

  const accessMessage =
    error === "access_denied"
      ? "You do not have access to that location. Pick one of your businesses below."
      : error === "invalid_business"
        ? "That location link was invalid. Pick one of your businesses below."
        : null;

  return <BusinessesHub accessMessage={accessMessage} />;
}
