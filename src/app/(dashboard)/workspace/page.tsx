import { redirect } from "next/navigation";

/** Old thin workspace queue — merged into the main Workspace home at /dashboard. */
export default function WorkspacePage() {
  redirect("/dashboard");
}
