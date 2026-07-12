import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import {
  buildEntityGridCells,
  buildYouEntity,
  entitiesFromTopCompetitors,
  metricsFromCells,
  solvFromCells,
  type GridEntityRef,
} from "@/lib/maps/grid-entity";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import type { BusinessRow, ScanResultRow } from "@/lib/db/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");
    const entityKey = url.searchParams.get("entityKey");

    await requireScanAccess(scanId);
    const supabase = createServiceClient();
    const gridData = await loadScanGridData(supabase, scanId, keywordId);
    if (!gridData) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const business = (gridData.business ?? {}) as BusinessRow;
    const you = buildYouEntity(business);
    const locationTokens = [
      gridData.activeKeyword?.city,
      gridData.activeKeyword?.state,
    ].filter((t): t is string => !!t?.trim());

    const results = gridData.results as ScanResultRow[];
    const topCompetitors = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      targetCategory: business.primary_category,
      keyword: gridData.activeKeyword?.keyword,
      locationTokens,
      limit: 5,
    });

    const competitorEntities = entitiesFromTopCompetitors(topCompetitors, 5);
    const entities: GridEntityRef[] = [you, ...competitorEntities];

    const resolveEntity = (key: string): GridEntityRef => {
      if (key === "you") return you;
      return competitorEntities.find((e) => e.key === key) ?? you;
    };

    const activeEntity = entityKey ? resolveEntity(entityKey) : you;
    const cells = buildEntityGridCells(gridData.points, results, activeEntity);
    const metrics = metricsFromCells(cells);

    return NextResponse.json({
      entity: activeEntity,
      entities: entities.map((e) => ({
        key: e.key,
        label: e.label,
        isTarget: e.isTarget ?? false,
      })),
      cells,
      metrics,
      solv: solvFromCells(cells),
      keyword: gridData.activeKeyword
        ? { id: gridData.activeKeyword.id, keyword: String(gridData.activeKeyword.keyword).trim() }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Competitors fetch failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

/** List competitor entities for toggle UI */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    await requireScanAccess(scanId);
    const supabase = createServiceClient();
    const body = (await request.json()) as { keywordId?: string };
    const gridData = await loadScanGridData(supabase, scanId, body.keywordId);
    if (!gridData) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const business = (gridData.business ?? {}) as BusinessRow;
    const you = buildYouEntity(business);
    const locationTokens = [
      gridData.activeKeyword?.city,
      gridData.activeKeyword?.state,
    ].filter((t): t is string => !!t?.trim());

    const results = gridData.results as ScanResultRow[];
    const topCompetitors = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      targetCategory: business.primary_category,
      keyword: gridData.activeKeyword?.keyword,
      locationTokens,
      limit: 5,
    });

    const entities: GridEntityRef[] = [
      you,
      ...entitiesFromTopCompetitors(topCompetitors, 5).map((e, i) => ({
        ...e,
        label: e.label || `Competitor ${i + 1}`,
      })),
    ];

    return NextResponse.json({
      entities: entities.map((e) => ({
        key: e.key,
        label: e.label,
        isTarget: e.isTarget ?? false,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Competitors list failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
