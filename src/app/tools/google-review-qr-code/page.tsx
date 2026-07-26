import { redirect } from "next/navigation";

/** Legacy tool URL — keep for bookmarks; canonical SEO page lives at the new path. */
export default function LegacyGoogleReviewQrToolPage() {
  redirect("/google-review-qr-code-generator");
}
