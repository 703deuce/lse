"use server";

import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getActionItemOrganizationId } from "@/lib/actions/action-item-access";
import { createServiceClient } from "@/lib/db/client";

export async function toggleActionItem(itemId: string, status: string) {
  const auth = await requireAuth();
  const orgId = await getActionItemOrganizationId(itemId);
  if (!orgId || orgId !== auth.organizationId) {
    throw new Error("Task not found or access denied");
  }

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
    scan_center_label?: string | null;
  }
) {
  await requireBusinessAccess(businessId);
  const supabase = createServiceClient();
  const { error } = await supabase.from("businesses").update(data).eq("id", businessId);
  if (error) throw new Error(error.message);
}
