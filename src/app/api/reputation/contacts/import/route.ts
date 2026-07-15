import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import { upsertBusinessContact } from "@/lib/reputation/contacts";
import { contactIdentity } from "@/lib/reputation/contacts-normalize";

type ImportMode = "create" | "update" | "skip";

type ImportRow = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerDate?: string | null;
  notes?: string | null;
  tags?: string[];
  externalCustomerId?: string | null;
};

const MAX_ROWS = 5000;

/**
 * Import contacts into the business CRM (not a campaign launch).
 * Opted-out contacts are never reactivated.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const mode = (body.mode as ImportMode | undefined) ?? "update";
    const filename = (body.filename as string | undefined) ?? "import.csv";
    const mapping = (body.mapping as Record<string, CsvMapTarget> | undefined) ?? {};
    const rows = (body.rows as ImportRow[] | undefined) ?? [];

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Import limited to ${MAX_ROWS} rows per request` },
        { status: 400 }
      );
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const supabase = createServiceClient();
    const startedAt = new Date().toISOString();
    const { data: upload, error: uploadErr } = await supabase
      .from("review_request_uploads")
      .insert({
        organization_id: auth.organizationId,
        business_id: businessId,
        filename,
        total_rows: rows.length,
        mapping_json: mapping,
        status: "running",
        started_at: startedAt,
        uploaded_by: auth.userId,
      })
      .select("id")
      .single();
    if (uploadErr) throw new Error(uploadErr.message);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const identity = contactIdentity({ phone: row.phone, email: row.email });
      if (!identity.phoneE164 && !identity.emailNormalized) {
        failed++;
        errors.push({ row: i + 1, error: "Missing valid phone or email" });
        continue;
      }

      try {
        if (mode === "skip") {
          let exists = false;
          if (identity.phoneE164) {
            const { data } = await supabase
              .from("review_request_contacts")
              .select("id")
              .eq("business_id", businessId)
              .eq("phone_e164", identity.phoneE164)
              .maybeSingle();
            exists = Boolean(data);
          }
          if (!exists && identity.emailNormalized) {
            const { data } = await supabase
              .from("review_request_contacts")
              .select("id")
              .eq("business_id", businessId)
              .eq("email_normalized", identity.emailNormalized)
              .maybeSingle();
            exists = Boolean(data);
          }
          if (exists) {
            skipped++;
            continue;
          }
        }

        if (mode === "create") {
          // Force insert failure path by checking first; upsert still used when missing.
          let exists = false;
          if (identity.phoneE164) {
            const { data } = await supabase
              .from("review_request_contacts")
              .select("id")
              .eq("business_id", businessId)
              .eq("phone_e164", identity.phoneE164)
              .maybeSingle();
            exists = Boolean(data);
          }
          if (!exists && identity.emailNormalized) {
            const { data } = await supabase
              .from("review_request_contacts")
              .select("id")
              .eq("business_id", businessId)
              .eq("email_normalized", identity.emailNormalized)
              .maybeSingle();
            exists = Boolean(data);
          }
          if (exists) {
            skipped++;
            continue;
          }
        }

        const result = await upsertBusinessContact({
          organizationId: auth.organizationId,
          businessId,
          firstName: row.firstName,
          lastName: row.lastName,
          customerName: row.fullName,
          phone: row.phone,
          email: row.email,
          notes: row.notes,
          tags: row.tags,
          externalCustomerId: row.externalCustomerId,
          customerDate: row.customerDate,
          source: "csv_import",
          consentState: "implied",
          consentSource: "csv_import",
        });
        if (mode === "create" && !result.created) {
          skipped++;
        } else {
          imported++;
        }
      } catch (e) {
        failed++;
        errors.push({
          row: i + 1,
          error: e instanceof Error ? e.message : "Import failed",
        });
      }
    }

    const completedAt = new Date().toISOString();
    await supabase
      .from("review_request_uploads")
      .update({
        valid_rows: imported + skipped,
        imported_rows: imported,
        skipped_rows: skipped,
        failed_rows: failed,
        status: "completed",
        error_report_json: errors.slice(0, 500),
        completed_at: completedAt,
      })
      .eq("id", upload.id);

    return NextResponse.json({
      uploadId: upload.id,
      total: rows.length,
      imported,
      skipped,
      failed,
      errors: errors.slice(0, 100),
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
