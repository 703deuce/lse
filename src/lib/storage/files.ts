import { supabaseAdmin } from "@/lib/supabase/admin";

const REVIEW_IMPORTS_BUCKET = "review-imports";
const REPORTS_BUCKET = "reports";

export function reviewImportPath(businessId: string, uploadId: string): string {
  return `businesses/${businessId}/review-imports/${uploadId}.csv`;
}

export function reportPath(businessId: string, reportId: string): string {
  return `businesses/${businessId}/reports/${reportId}.pdf`;
}

export async function uploadReviewImportCsv(params: {
  businessId: string;
  uploadId: string;
  fileBuffer: Buffer | Uint8Array;
}): Promise<{ path: string }> {
  const path = reviewImportPath(params.businessId, params.uploadId);
  const { error } = await supabaseAdmin.storage
    .from(REVIEW_IMPORTS_BUCKET)
    .upload(path, params.fileBuffer, {
      contentType: "text/csv",
      upsert: false,
    });

  if (error) throw new Error(`CSV upload failed: ${error.message}`);
  return { path };
}

export async function createSignedReportUrl(params: {
  businessId: string;
  reportId: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const path = reportPath(params.businessId, params.reportId);
  const { data, error } = await supabaseAdmin.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(path, params.expiresInSeconds ?? 600);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return data.signedUrl;
}
