import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider } from "@/components/auth/auth-divider";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { safeNextPath } from "@/lib/auth/safe-next";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; claim?: string }>;
}) {
  const params = await searchParams;
  // Prefer explicit next; else claim token → post-signup QR claim page.
  const derivedNext = params.claim
    ? `/reputation/qr-claim?claim=${encodeURIComponent(params.claim)}`
    : null;
  const safeNext = safeNextPath(params.next ?? derivedNext);
  const signInHref =
    safeNext !== "/workspace"
      ? `/sign-in?next=${encodeURIComponent(safeNext)}`
      : "/sign-in";
  const savingQr = Boolean(params.claim || (params.next ?? "").includes("qr-claim"));

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        savingQr
          ? "Create a free account to save your Google review QR code and track scans."
          : "Start running unlimited GeoGrid map scans and client-ready reports—no credits."
      }
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
