import { createServiceClient } from "@/lib/db/client";

export async function setBusinessGeom(businessId: string, lng: number, lat: number): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("set_business_geom", { p_id: businessId, p_lng: lng, p_lat: lat });
}

export async function setScanPointGeom(pointId: string, lng: number, lat: number): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("set_scan_point_geom", { p_id: pointId, p_lng: lng, p_lat: lat });
}

export async function setScanPointsGeom(
  points: Array<{ id: string; lng: number; lat: number }>
): Promise<void> {
  await Promise.all(points.map((p) => setScanPointGeom(p.id, p.lng, p.lat)));
}
