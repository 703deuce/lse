import { requireAuth } from "@/lib/auth/context";
import { SecuritySettingsClient } from "@/components/settings/security-settings-client";
import { redirect } from "next/navigation";

export default async function SecuritySettingsPage() {
  const auth = await requireAuth().catch(() => null);
  if (!auth?.isAuthenticated) redirect("/sign-in");

  return <SecuritySettingsClient />;
}
