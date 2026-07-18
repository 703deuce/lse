import { requirePageAuth } from "@/lib/auth/context";
import { AccountsHub } from "@/components/accounts/accounts-hub";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageAuth();
  const { error } = await searchParams;

  const accessMessage =
    error === "access_denied"
      ? "You do not have access to that location. Pick one of your clients below."
      : error === "invalid_business"
        ? "That location link was invalid. Pick one of your clients below."
        : null;

  return <AccountsHub mode="clients" accessMessage={accessMessage} />;
}
