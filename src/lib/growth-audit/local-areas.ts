import { createServiceClient } from "@/lib/db/client";
import type { GbpProfile } from "@/lib/audit/types";

export type ServiceArea = {
  name: string;
  type: "city" | "neighborhood" | "location";
  city?: string | null;
};

/** Load real service-area names from rank locations, keyword cities, and GBP — not hardcoded lists. */
export async function loadServiceAreas(
  businessId: string,
  gbp: GbpProfile
): Promise<ServiceArea[]> {
  const db = createServiceClient();
  const seen = new Map<string, ServiceArea>();

  function add(name: string, type: ServiceArea["type"], city?: string | null) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, { name: trimmed, type, city: city ?? null });
  }

  if (gbp.city) add(gbp.city, "city", gbp.city);

  const { data: locations } = await db
    .from("rank_locations")
    .select("name, city, state")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  for (const loc of locations ?? []) {
    if (loc.name) add(loc.name, "location", loc.city);
    if (loc.city) add(loc.city, "city", loc.city);
  }

  const { data: keywords } = await db
    .from("business_keywords")
    .select("city, state")
    .eq("business_id", businessId);

  for (const kw of keywords ?? []) {
    if (kw.city) add(kw.city, "city", kw.city);
  }

  const { data: batch } = await db
    .from("scan_batches")
    .select("center_label")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (batch?.center_label) {
    const label = String(batch.center_label).trim();
    if (label && !label.toLowerCase().includes("business")) {
      add(label, "neighborhood", gbp.city);
    }
  }

  const { data: biz } = await db
    .from("businesses")
    .select("address_text")
    .eq("id", businessId)
    .maybeSingle();

  if (biz?.address_text) {
    const parts = biz.address_text.split(",").map((p: string) => p.trim());
    for (const part of parts) {
      if (/^[A-Za-z\s.'-]{2,40}$/.test(part) && !/\d{5}/.test(part) && part.length > 2) {
        if (!/^(suite|ste|unit|#)/i.test(part)) {
          add(part, "neighborhood", gbp.city);
        }
      }
    }
  }

  return [...seen.values()].slice(0, 14);
}
