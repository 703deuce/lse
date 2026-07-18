import { requirePageAuth } from "@/lib/auth/context";
import { AccountsHub } from "@/components/accounts/accounts-hub";

export default async function ProspectsPage() {
  await requirePageAuth();
  return <AccountsHub mode="prospects" />;
}
