import Link from "next/link";

export default async function TrackingLinkUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const title =
    reason === "paused"
      ? "This review link is paused"
      : reason === "missing"
        ? "This review link was not found"
        : "This review link is unavailable";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E6EAF0] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#137752]">
          Local SEO Express
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#101828]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          The QR code or link you scanned is not active right now. Ask the business for an updated
          review link, or visit their Google Business Profile to leave a review.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#137752] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Go to Local SEO Express
        </Link>
      </div>
    </main>
  );
}
