import Link from "next/link";
import { btnPrimary } from "@/components/ui/design-system";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F3F5F7] px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#137752]">404</p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600">
        This link is missing, you do not have access to that business, or the page was removed.
        Module Run buttons do not navigate here — if a Run failed, stay on the module page and check
        the error banner.
      </p>
      <Link href="/workspace" className={`mt-6 ${btnPrimary}`}>
        Back to Workspace
      </Link>
    </main>
  );
}
