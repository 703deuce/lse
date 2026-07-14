import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getActionItemOrganizationId } from "@/lib/actions/action-item-access";
import { createServiceClient } from "@/lib/db/client";
import { updateTaskSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const orgId = await getActionItemOrganizationId(parsed.data.itemId);
    if (!orgId || orgId !== auth.organizationId) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("action_items")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.itemId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
