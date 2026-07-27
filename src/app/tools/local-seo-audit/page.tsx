import type { Metadata } from "next";
import { LocalSeoAuditTool } from "@/components/tools/local-seo-audit-tool";

export const metadata: Metadata = {
  title: "Local SEO Audit (Free) | Local SEO Express",
  description:
    "Run a free Google Business Profile / local SEO audit. Get a score and a clear list of what to fix next.",
  alternates: {
    canonical: "https://localseoexpress.com/local-seo-audit/",
  },
};

export default async function LocalSeoAuditToolPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  return <LocalSeoAuditTool embed={embed} />;
}
