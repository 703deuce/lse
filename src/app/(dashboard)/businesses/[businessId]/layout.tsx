import { requireBusinessPage } from "@/lib/auth/require-business-page";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return children;
}
