"use server";

import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

export async function toggleActionItem(itemId: string, status: string) {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase.from("action_items").update({ status }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function updateBusinessSettings(
  businessId: string,
  data: {
    grid_size?: number;
    radius_meters?: number;
    scan_center_lat?: number;
    scan_center_lng?: number;
  }
) {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase.from("businesses").update(data).eq("id", businessId);
  if (error) throw new Error(error.message);
}
