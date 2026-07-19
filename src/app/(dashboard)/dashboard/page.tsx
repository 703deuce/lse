import { redirect } from "next/navigation";

/** Legacy URL — org home is Workspace. */
export default function DashboardRedirectPage() {
  redirect("/workspace");
}
