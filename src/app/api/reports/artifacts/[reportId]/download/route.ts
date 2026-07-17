import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { createSignedArtifactUrl } from "@/lib/reporting/artifacts";

/**
 * Tenant-scoped redirect to a short-lived signed storage URL.
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

    const signedUrl = await createSignedArtifactUrl({
      path: report.storage_path as string,
      expiresInSeconds: 600,
    });

    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    return httpErrorFromException(err, "Download failed");
  }
}
