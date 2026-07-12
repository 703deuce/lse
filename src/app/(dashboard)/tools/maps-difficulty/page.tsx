import { requireAuth } from "@/lib/auth/context";
import { MapsDifficultyTool } from "@/components/maps-difficulty/maps-difficulty-tool";

export const dynamic = "force-dynamic";

export default async function MapsDifficultyPage() {
  await requireAuth();
  return <MapsDifficultyTool />;
}
