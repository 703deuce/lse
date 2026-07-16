import { createServiceClient } from "@/lib/db/client";
import { buildSingleScanReport } from "@/lib/reporting/build-single-scan";
import {
  artifactIdentityKey,
  artifactStoragePath,
  brandingVersionFromWhiteLabel,
  findReadyArtifact,
  markArtifactReady,
  uploadReportArtifact,
} from "@/lib/reporting/artifacts";
import {
  artifactContentType,
  SINGLE_SCAN_PDF_TEMPLATE_VERSION,
  type CompetitorLimit,
  type ReportArtifactKind,
} from "@/lib/reporting/pdf/constants";
import { renderHeatmapGridPng } from "@/lib/reporting/pdf/render-heatmap-image";
import { renderScanMapPng } from "@/lib/reporting/pdf/render-map-image";
import { renderSingleScanPdf } from "@/lib/reporting/pdf/render-single-scan-pdf";
import { singleScanPointsCsv, singleScanSummaryCsv } from "@/lib/reporting/scan-csv";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import { logger } from "@/lib/observability/logger";

export type GenerateScanArtifactResult = {
  reportId: string;
  kind: ReportArtifactKind;
  storagePath: string;
  bytes: number;
  reused: boolean;
  downloadPath: string;
};

async function ensureReportRow(params: {
  businessId: string;
  scanBatchId: string;
  kind: ReportArtifactKind;
  identityKey: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>identityKey", params.identityKey)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("reports")
      .update({
        artifact_status: "generating",
        artifact_kind: params.kind,
        error_message: null,
        scan_batch_id: params.scanBatchId,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: params.scanBatchId,
      artifact_kind: params.kind,
      artifact_status: "generating",
      template_version: SINGLE_SCAN_PDF_TEMPLATE_VERSION,
      metadata_json: {
        reportType: "single_scan",
        identityKey: params.identityKey,
        artifactKind: params.kind,
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create report row");
  return data.id as string;
}

export async function generateScanArtifact(params: {
  businessId: string;
  scanBatchId: string;
  kind: ReportArtifactKind;
  competitorLimit?: CompetitorLimit;
  force?: boolean;
}): Promise<GenerateScanArtifactResult> {
  const started = Date.now();
  const supabase = createServiceClient();
  const gridData = await loadScanGridData(supabase, params.scanBatchId);
  if (!gridData) throw new Error("Scan not found");
  if (gridData.batch.business_id !== params.businessId) {
    throw new Error("Scan does not belong to business");
  }

  const payload = await buildSingleScanReport({
    businessId: params.businessId,
    scanBatchId: params.scanBatchId,
  });

  const centerLat =
    gridData.batch.center_lat ??
    gridData.business?.scan_center_lat ??
    gridData.business?.lat ??
    0;
  const centerLng =
    gridData.batch.center_lng ??
    gridData.business?.scan_center_lng ??
    gridData.business?.lng ??
    0;

  const dataVersion = String(
    gridData.batch.finished_at ?? gridData.batch.updated_at ?? gridData.batch.created_at
  );
  const brandingVersion = brandingVersionFromWhiteLabel(payload.whiteLabel);
  const identityKey = artifactIdentityKey({
    kind: params.kind,
    scanBatchId: params.scanBatchId,
    competitorLimit: params.competitorLimit ?? 20,
    brandingVersion,
    dataVersion,
  });

  if (!params.force) {
    const ready = await findReadyArtifact({
      businessId: params.businessId,
      identityKey,
    });
    if (ready?.storagePath) {
      return {
        reportId: ready.id,
        kind: params.kind,
        storagePath: ready.storagePath,
        bytes: 0,
        reused: true,
        downloadPath: `/api/reports/artifacts/${ready.id}/download`,
      };
    }
  }

  const reportId = await ensureReportRow({
    businessId: params.businessId,
    scanBatchId: params.scanBatchId,
    kind: params.kind,
    identityKey,
  });

  try {
    let buffer: Buffer;

    if (params.kind === "summary_csv") {
      buffer = Buffer.from(singleScanSummaryCsv(payload), "utf8");
    } else if (params.kind === "points_csv") {
      buffer = Buffer.from(singleScanPointsCsv(payload), "utf8");
    } else {
      const rankByLabel = new Map(payload.heatmap.cells.map((c) => [c.label, c.rank]));
      const pins = gridData.points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        rank: rankByLabel.get(p.grid_label) ?? null,
      }));

      const mapPng = await renderScanMapPng({
        centerLat,
        centerLng,
        radiusMeters: payload.parameters.radiusMeters,
        gridSize: payload.parameters.gridSize,
        pins,
      });

      if (params.kind === "map_png") {
        buffer = mapPng;
      } else if (params.kind === "heatmap_png") {
        buffer = await renderHeatmapGridPng({
          gridSize: payload.parameters.gridSize,
          cells: payload.heatmap.cells,
        });
      } else {
        const heatmapPng = await renderHeatmapGridPng({
          gridSize: payload.parameters.gridSize,
          cells: payload.heatmap.cells,
        });
        buffer = await renderSingleScanPdf({
          payload,
          mapPng,
          heatmapPng,
          reportId,
          competitorLimit: params.competitorLimit ?? 20,
          centerLat,
          centerLng,
        });
      }
    }

    const storagePath = artifactStoragePath({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      kind: params.kind,
      reportId,
    });

    await uploadReportArtifact({
      path: storagePath,
      buffer,
      contentType: artifactContentType(params.kind),
    });

    const generationMs = Date.now() - started;
    await markArtifactReady({
      reportId,
      businessId: params.businessId,
      storagePath,
      kind: params.kind,
      bytes: buffer.byteLength,
      generationMs,
      identityKey,
      scanBatchId: params.scanBatchId,
      brandingVersion,
      dataVersion,
    });

    logger.info("scan_artifact_generated", {
      reportId,
      kind: params.kind,
      bytes: buffer.byteLength,
      generationMs,
      reused: false,
    });

    return {
      reportId,
      kind: params.kind,
      storagePath,
      bytes: buffer.byteLength,
      reused: false,
      downloadPath: `/api/reports/artifacts/${reportId}/download`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("reports")
      .update({
        artifact_status: "failed",
        error_message: message.slice(0, 500),
      })
      .eq("id", reportId);
    throw err;
  }
}
