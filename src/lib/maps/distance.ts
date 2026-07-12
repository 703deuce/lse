const EARTH_RADIUS_M = 6371000;
const METERS_PER_MILE = 1609.344;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / METERS_PER_MILE;
}

export type DistanceBucket = "0-1" | "1-3" | "3-5" | "5+";

export function distanceBucketMiles(miles: number): DistanceBucket {
  if (miles < 1) return "0-1";
  if (miles < 3) return "1-3";
  if (miles < 5) return "3-5";
  return "5+";
}

export const DISTANCE_BUCKET_LABELS: Record<DistanceBucket, string> = {
  "0-1": "0–1 mi",
  "1-3": "1–3 mi",
  "3-5": "3–5 mi",
  "5+": "5+ mi",
};

