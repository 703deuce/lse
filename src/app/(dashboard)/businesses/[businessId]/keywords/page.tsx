import { KeywordTrackerDashboard } from "@/components/keyword-tracker/keyword-dashboard";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <KeywordTrackerDashboard businessId={businessId} />;
}
