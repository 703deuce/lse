import { requireAuth } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { MapsDifficultyTool } from "@/components/maps-difficulty/maps-difficulty-tool";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MapsDifficultyPage() {
  const auth = await requireAuth();
  const allowed = await hasFeature(auth.organizationId, "maps_keyword_difficulty_internal_only");
  if (!allowed) notFound();
  return <MapsDifficultyTool />;
}
