/**
 * Resolve the Maps JavaScript API key.
 * Coolify commonly stores this as `MAPS`; also accept common Google / public aliases.
 */
export function getGoogleMapsApiKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPS?.trim() ||
    process.env.MAPS?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_KEY?.trim() ||
    "";
  return key || undefined;
}
