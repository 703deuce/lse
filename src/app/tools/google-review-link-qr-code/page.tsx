import { redirect } from "next/navigation";

export default async function GoogleReviewLinkQrAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  redirect(
    embed
      ? "/google-review-qr-code-generator?embed=1"
      : "/google-review-qr-code-generator"
  );
}