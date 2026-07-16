import { ResearchPanel } from "@/components/research/research-panel";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  return <ResearchPanel businessId={businessId} />;
}
