import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { geocodeAddress } from "@/lib/maps-difficulty/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = (await request.json()) as { address?: string };
    const address = body.address?.trim();
    if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
    const geo = await geocodeAddress(address);
    return NextResponse.json(geo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geocoding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
