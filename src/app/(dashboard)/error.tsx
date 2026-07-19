"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches uncaught render errors under the dashboard so users never see
 * Next's builtin global-error ("This page couldn’t load / Reload… / Back").
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error", error.message, error.digest);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This screen crashed while loading. Your jobs may still be running in the
        background — go back to the business and refresh the module.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Try again
        </button>
        <Link
          href="/workspace"
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to Workspace
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-zinc-400">Error {error.digest}</p>
      ) : null}
    </main>
  );
}
