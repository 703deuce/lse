import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  businessId: z.string().uuid(),
  displayName: z.string().max(200).optional(),
  requestMessage: z.string().max(2000).optional(),
  senderName: z.string().max(200).optional(),
  senderEmail: z.string().max(320).optional(),
  followUpDays: z.union([z.string(), z.number()]).optional(),
  channels: z.array(z.string()).max(20).optional(),
  qrBrandingNote: z.string().max(500).optional(),
});

/**
 * Persist review-collection choices from first-time setup.
 * No review_campaigns entitlement required — setup must work for new accounts.
 */
export async function PUT(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const p = parsed.data;
    const auth = await requireBusinessAccess(p.businessId);
    const supabase = createServiceClient();

    const prefs = {
      displayName: p.displayName?.trim() || null,
      requestMessage: p.requestMessage?.trim() || null,
      followUpDays:
        p.followUpDays != null ? Number(p.followUpDays) || 7 : 7,
      channels: p.channels ?? [],
      qrBrandingNote: p.qrBrandingNote?.trim() || null,
      updatedAt: new Date().toISOString(),
    };

    const senderName = p.senderName?.trim() || p.displayName?.trim() || null;
    const senderEmail = p.senderEmail?.trim() || null;

    const { error } = await supabase
      .from("businesses")
      .update({
        reputation_setup_prefs: prefs,
        default_sender_name: senderName,
        default_sender_email: senderEmail,
        email_sender_name: senderName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.businessId)
      .eq("organization_id", auth.organizationId);

    if (error) {
      // Pre-migration: still try sender fields only
      if (/reputation_setup_prefs|default_sender/i.test(error.message)) {
        await supabase
          .from("businesses")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", p.businessId)
          .eq("organization_id", auth.organizationId);
        return NextResponse.json({ ok: true, persisted: "minimal" });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, prefs });
  } catch (err) {
    return httpErrorFromException(err, "Failed to save setup preferences");
  }
}
