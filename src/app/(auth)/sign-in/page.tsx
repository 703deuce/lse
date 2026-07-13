import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { getDevDefaultAppPath, isDevBypassEnabled } from "@/lib/auth/dev";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const devBypass = isDevBypassEnabled();
  const devHref = params.next?.startsWith("/") ? params.next : getDevDefaultAppPath();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-8">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-8 shadow-1">
        <h1 className="ds-h2 text-center text-[28px] leading-[36px]">Sign in</h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          Sign in with Google to access your Local SEO workspace.
        </p>

        {params.error === "auth_callback_failed" && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Sign-in failed. Please try again.
          </p>
        )}

        <div className="mt-6">
          <GoogleSignInButton />
        </div>

        {devBypass && (
          <div className="mt-6 border-t border-border pt-6 text-center">
            <p className="text-xs text-text-muted">Development only</p>
            <Link
              href={devHref}
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Continue in dev mode (no login)
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
