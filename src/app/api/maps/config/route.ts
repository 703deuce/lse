import { NextResponse } from "next/server";
import { getBrowserGoogleMapsApiKey } from "@/lib/maps/google-maps-key";

export const dynamic = "force-dynamic";

/** Exposes only the browser-safe Maps JS key (NEXT_PUBLIC_*). */
export async function GET() {
  const apiKey = getBrowserGoogleMapsApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Google Maps browser API key is not configured (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_MAPS).",
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ apiKey });
}
