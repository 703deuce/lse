"use client";

/**
 * Root crash boundary. Replaces Next's builtin "This page couldn’t load /
 * Reload to try again, or go back" with a recoverable screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-[#F3F5F7] px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The app hit a server error while loading this screen. Try again, or
          return to your businesses list.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#137752] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] transition hover:bg-[#0f6344]"
          >
            Try again
          </button>
          <a
            href="/workspace"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200/90 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-zinc-50"
          >
            Back to Workspace
          </a>
        </div>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-zinc-400">Error {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
