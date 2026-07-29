import { redirect } from "next/navigation";

/** Legacy alias: /pay/{slug} → /p/{slug} */
export default async function PaymentPublicPageAlias({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/p/${encodeURIComponent(slug)}`);
}
