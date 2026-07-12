import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-8">
      <div className="max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center shadow-1">
        <h1 className="ds-h2 text-[28px] leading-[36px]">Sign in</h1>
        <p className="mt-4 text-text-muted">
          Firebase authentication will be wired here. For now, dev mode bypasses login.
        </p>
        <Link
          href="/businesses"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Continue in dev mode
        </Link>
      </div>
    </div>
  );
}
