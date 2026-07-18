import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";

/** Legacy /businesses hub → freelancer Clients list. */
export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageAuth();
  const { error } = await searchParams;
  const qs = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/clients${qs}`);
}
