import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("app_notifications")
      .select("id, event_type, title, body, href, read_at, created_at")
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      if (/app_notifications|does not exist/i.test(error.message)) {
        return NextResponse.json({ notifications: [], migrationPending: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load notifications");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const id = body?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", auth.organizationId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update notification");
  }
}
