import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { resolvePostLoginPath } from "@/lib/auth/home-path";

export default async function HomePage() {
  const auth = await getAuthContext();
  if (!auth.isAuthenticated) {
    redirect("/sign-in");
  }
  redirect(await resolvePostLoginPath(auth.organizationId));
}
