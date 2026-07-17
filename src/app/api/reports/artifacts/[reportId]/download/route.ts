import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertSafeArtifactStoragePath } from "@/lib/reporting/artifact-path";
import { artifactFileExtension } from "@/lib/reporting/pdf/constants";
import type { ReportArtifactKind } from "@/lib/reporting/pdf/constants";

const REPORTS_BUCKET = "reports";

/**
 * Tenant-scoped artifact download.
 * Streams the file through the app (same-origin) so the browser does not
 * navigate away to a signed storage URL (which shows as "page not available"
 * when storage is misconfigured or CORP/CSP blocks the host).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const supabase = createServiceClient();
    const { data: report } = await supabase
      .from("reports")
      .select("id, business_id, storage_path, artifact_status, content_type, artifact_kind")
      .eq("id", reportId)
      .maybeSingle();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await requireBusinessAccess(report.business_id as string);

    if (report.artifact_status !== "ready" || !report.storage_path) {
      return NextResponse.json(
        { error: "Artifact not ready", status: report.artifact_status },
        { status: 409 }
      );
    }

    const storagePath = String(report.storage_path);
    assertSafeArtifactStoragePath(storagePath);

    const { data: file, error } = await supabaseAdmin.storage
      .from(REPORTS_BUCKET)
      .download(storagePath);
    if (error || !file) {
      return NextResponse.json(
        { error: error?.message ?? "Artifact file missing from storage" },
        { status: 404 }
      );
    }

    const kind = (report.artifact_kind as ReportArtifactKind | null) ?? null;
    const ext = kind ? artifactFileExtension(kind) : "bin";
    const contentType =
      (report.content_type as string | null) || "application/octet-stream";
    const bytes = Buffer.from(await file.arrayBuffer());

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="scan-export.${ext}"`,
        "Cache-Control": "private, no-store",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Download failed");
  }
}
