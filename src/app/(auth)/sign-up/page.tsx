import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Sign up</h1>
        <p className="mt-4 text-text-muted">
          Account creation will use Firebase Auth. Dev mode is active until then.
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
