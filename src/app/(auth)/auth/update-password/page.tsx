import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { requirePageAuth } from "@/lib/auth/context";

export default async function UpdatePasswordPage() {
  await requirePageAuth();

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your Local SEO Express account."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
