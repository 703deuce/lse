import type { Metadata } from "next";
import { MapsRankChecker } from "@/components/tools/maps-rank-checker";

export const metadata: Metadata = {
  title: "Free Google Maps Rank Checker | Local SEO Express",
  description:
    "Check where your business ranks on Google Maps for one keyword at your location. Sign up for full area grid scans and ranking history.",
  alternates: {
    canonical: "https://localseoexpress.com/tools/google-maps-rank-checker/",
  },
};

export default async function GoogleMapsRankCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  return <MapsRankChecker embed={embed} />;
}
