import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getBrowserGoogleMapsApiKey } from "@/lib/maps/google-maps-key";
import { httpErrorFromException } from "@/lib/security/http-errors";

export const dynamic = "force-dynamic";

/** Exposes the Maps JS key from server env (MAPS / NEXT_PUBLIC_*) to authenticated clients. */
export async function GET() {
  try {
    await requireAuth();
    const apiKey = getBrowserGoogleMapsApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Google Maps browser API key is not configured (set MAPS, NEXT_PUBLIC_MAPS, or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ apiKey });
  } catch (err) {
    return httpErrorFromException(err, "Maps configuration unavailable");
  }
}
