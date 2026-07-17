import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { AiVisibilityPromptsPage } from "@/components/ai-visibility/ai-visibility-prompts-page";

export default async function AiVisibilityPromptsRoute({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPageData(businessId);

  return <AiVisibilityPromptsPage businessId={businessId} />;
}
