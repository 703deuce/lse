import { redirect } from "next/navigation";

/** Permanent business payment page alias: /p/{slug} → /pay/{slug} */
export default async function PermanentPaymentAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/pay/${encodeURIComponent(slug)}`);
}
