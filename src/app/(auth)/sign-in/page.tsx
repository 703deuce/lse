import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider } from "@/components/auth/auth-divider";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { getDevDefaultAppPath, isDevBypassEnabled } from "@/lib/auth/dev";
import { safeNextPath } from "@/lib/auth/safe-next";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const devBypass = isDevBypassEnabled();
  const safeNext = safeNextPath(params.next ?? null);
  const signUpHref =
    params.next && safeNext !== "/workspace"
      ? `/sign-up?next=${encodeURIComponent(safeNext)}`
      : "/sign-up";
  const devHref =
    params.next && safeNext !== "/workspace" ? safeNext : getDevDefaultAppPath();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Local SEO Express workspace—GeoGrid scans, reports, and client proof."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={signUpHref} className="font-semibold text-[#137752] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {params.error === "auth_callback_failed" ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Sign-in failed. Please try again.
        </p>
      ) : null}

      <EmailAuthForm mode="signin" />
      <AuthDivider />
      <GoogleSignInButton />

      {devBypass ? (
        <div className="mt-6 border-t border-zinc-100 pt-5 text-center">
          <p className="text-xs text-zinc-400">Development only</p>
          <Link
            href={devHref}
            className="mt-1 inline-block text-sm font-medium text-[#137752] hover:underline"
          >
            Continue in dev mode (no login)
          </Link>
        </div>
      ) : null}
    </AuthShell>
  );
}
