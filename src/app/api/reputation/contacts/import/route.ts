import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import {
  errorReportToCsv,
  mappedRowsToImportRows,
  previewContactImport,
  runContactImport,
  type ContactImportMode,
  type ContactImportRow,
} from "@/lib/reputation/contact-import";
import { enqueueImportContactsJob } from "@/lib/jobs/queue";

const SYNC_ROW_LIMIT = 200;
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const uploadId = url.searchParams.get("uploadId");
    const downloadErrors = url.searchParams.get("downloadErrors") === "1";
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const supabase = createServiceClient();

    if (uploadId && downloadErrors) {
      const { data } = await supabase
        .from("review_request_uploads")
        .select("error_report_json, filename")
        .eq("id", uploadId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: "Import not found" }, { status: 404 });
      const errors = Array.isArray(data.error_report_json)
        ? (data.error_report_json as Array<{ row: number; error: string }>)
        : [];
      const csv = errorReportToCsv(errors);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-errors-${uploadId.slice(0, 8)}.csv"`,
        },
      });
    }

    const { data: uploads } = await supabase
      .from("review_request_uploads")
      .select(
        "id, filename, total_rows, valid_rows, imported_rows, skipped_rows, failed_rows, status, mode, started_at, completed_at, created_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({ imports: uploads ?? [] });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const action = (body.action as string | undefined) ?? "import";
    const mode = (body.mode as ContactImportMode | undefined) ?? "update";
    const filename = (body.filename as string | undefined) ?? "import.csv";
    const mapping = (body.mapping as Record<string, CsvMapTarget> | undefined) ?? {};

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    let rows: ContactImportRow[] = Array.isArray(body.rows) ? body.rows : [];
    if ((!rows.length || action === "preview") && Array.isArray(body.csvRows) && Array.isArray(body.headers)) {
      rows = mappedRowsToImportRows(body.headers, body.csvRows, mapping);
    }

    if (!rows.length) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Import limited to ${MAX_ROWS} rows per request` },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const preview = await previewContactImport({ businessId, rows });
      return NextResponse.json(preview);
    }

    const supabase = createServiceClient();
    const startedAt = new Date().toISOString();
    const useBackground = rows.length > SYNC_ROW_LIMIT || body.background === true;

    const { data: upload, error: uploadErr } = await supabase
      .from("review_request_uploads")
      .insert({
        organization_id: auth.organizationId,
        business_id: businessId,
        filename,
        total_rows: rows.length,
        mapping_json: mapping,
        status: useBackground ? "queued" : "running",
        mode,
        started_at: startedAt,
        uploaded_by: auth.userId,
        rows_json: useBackground ? rows : null,
      })
      .select("id")
      .single();
    if (uploadErr) throw new Error(uploadErr.message);

    if (useBackground) {
      await enqueueImportContactsJob({
        uploadId: upload.id,
        businessId,
        organizationId: auth.organizationId,
        mode,
      });
      return NextResponse.json({
        uploadId: upload.id,
        status: "queued",
        message: "Large import queued — the Coolify cron worker will process it.",
        total: rows.length,
      });
    }

    const result = await runContactImport({
      organizationId: auth.organizationId,
      businessId,
      uploadId: upload.id,
      mode,
      rows,
      userId: auth.userId,
    });

    return NextResponse.json({
      uploadId: upload.id,
      status: "completed",
      total: rows.length,
      ...result,
      errors: result.errors.slice(0, 100),
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
