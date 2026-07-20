import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider } from "@/components/auth/auth-divider";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { safeNextPath } from "@/lib/auth/safe-next";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const safeNext = safeNextPath(params.next ?? null);
  const signInHref =
    params.next && safeNext !== "/workspace"
      ? `/sign-in?next=${encodeURIComponent(safeNext)}`
      : "/sign-in";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start running unlimited GeoGrid map scans and client-ready reports—no credits."
      footer={
        <>
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-[#137752] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <EmailAuthForm mode="signup" />
      <AuthDivider label="or sign up with" />
      <GoogleSignInButton label="Continue with Google" />
    </AuthShell>
  );
}
