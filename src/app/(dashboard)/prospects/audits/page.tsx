import { requirePageAuth } from "@/lib/auth/context";
import { ProspectAuditsHub } from "@/components/prospect-audit/prospect-audits-hub";

export default async function ProspectAuditsPage() {
  await requirePageAuth();
  return <ProspectAuditsHub />;
}
