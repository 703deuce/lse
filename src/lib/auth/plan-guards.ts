import { hasFeature } from "@/lib/plans";

export async function requireInternalMapsDifficulty(organizationId: string): Promise<void> {
  const allowed = await hasFeature(organizationId, "maps_keyword_difficulty_internal_only");
  if (!allowed) {
    throw new Error("Maps Keyword Difficulty is internal-only.");
  }
}
