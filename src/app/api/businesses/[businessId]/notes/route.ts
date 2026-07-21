import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

const notesSchema = z.object({
  notes: z.string().max(20_000).nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("businesses")
      .select("id, notes, updated_at")
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ notes: data.notes ?? "", updatedAt: data.updated_at });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load notes");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("business.update", auth.organizationId);

    const body = await request.json();
    const parsed = notesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("businesses")
      .update({
        notes: parsed.data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .select("id, notes, updated_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      notes: data.notes ?? "",
      updatedAt: data.updated_at,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to save notes");
  }
}
