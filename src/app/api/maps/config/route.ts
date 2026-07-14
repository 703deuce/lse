import { NextResponse } from "next/server";
import { getGoogleMapsApiKey } from "@/lib/maps/google-maps-key";

export const dynamic = "force-dynamic";

/** Exposes the browser Maps JS key from Coolify `MAPS` (and aliases) at request time. */
export async function GET() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured (set MAPS in Coolify)." },
      { status: 503 }
    );
  }
  return NextResponse.json({ apiKey });
}
