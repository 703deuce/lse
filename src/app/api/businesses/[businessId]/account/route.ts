import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
const prospectStatusSchema = z.enum([
  "new",
  "contacted",
  "audit_sent",
  "proposal_sent",
  "won",
  "lost",
  "archived",
]);

const patchSchema = z.object({
  accountType: z.enum(["prospect", "client"]).optional(),
  prospectStatus: prospectStatusSchema.nullable().optional(),
  primaryContactName: z.string().max(200).nullable().optional(),
  primaryContactEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional(),
  notes: z.string().max(20_000).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  websiteUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  archive: z.boolean().optional(),
  restore: z.boolean().optional(),
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
      .select(
        "id, name, website_url, phone, address_text, scan_center_label, primary_category, is_tracked, account_type, prospect_status, primary_contact_name, primary_contact_email, notes, tags, archived_at, created_at, updated_at"
      )
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ account: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load account");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const p = parsed.data;
    const supabase = createServiceClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (p.accountType !== undefined) patch.account_type = p.accountType;
    if (p.prospectStatus !== undefined) patch.prospect_status = p.prospectStatus;
    if (p.primaryContactName !== undefined) patch.primary_contact_name = p.primaryContactName;
    if (p.primaryContactEmail !== undefined) {
      patch.primary_contact_email = p.primaryContactEmail || null;
    }
    if (p.notes !== undefined) patch.notes = p.notes;
    if (p.phone !== undefined) patch.phone = p.phone;
    if (p.websiteUrl !== undefined) patch.website_url = p.websiteUrl || null;

    if (p.archive === true) {
      patch.archived_at = new Date().toISOString();
      patch.is_tracked = false;
      if (p.accountType === undefined) {
        // keep account_type; mark prospect pipeline archived when prospect
      }
    }
    if (p.restore === true) {
      patch.archived_at = null;
    }

    const { data, error } = await supabase
      .from("businesses")
      .update(patch)
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .select(
        "id, name, account_type, prospect_status, is_tracked, archived_at, notes, primary_contact_name, primary_contact_email"
      )
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, account: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update account");
  }
}
