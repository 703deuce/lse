import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const auth = await requireAuth();
    const body = await request.json();
    const status = (body as { status?: string }).status ?? "done";

    const supabase = createServiceClient();
    const { data: task } = await supabase
      .from("review_momentum_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from("review_momentum_tasks")
      .update({ status })
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
