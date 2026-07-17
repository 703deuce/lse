import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { geocodeAddress } from "@/lib/maps-difficulty/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Address or city/state → lat/lng for Maps Scans setup.
 * Uses Nominatim (no Google Geocoding bill). Auth required.
 */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = (await request.json()) as { address?: string };
    const address = body.address?.trim();
    if (!address) {
      return NextResponse.json({ error: "Enter an address, or a city and state." }, { status: 400 });
    }
    const geo = await geocodeAddress(address);
    return NextResponse.json(geo);
  } catch (err) {
    return httpErrorFromException(err, "Geocoding failed");
  }
}
