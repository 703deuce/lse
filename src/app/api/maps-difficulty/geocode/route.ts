import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireInternalMapsDifficulty } from "@/lib/auth/plan-guards";
import { geocodeAddress } from "@/lib/maps-difficulty/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    await requireInternalMapsDifficulty(auth.organizationId);
    const body = (await request.json()) as { address?: string };
    const address = body.address?.trim();
    if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
    const geo = await geocodeAddress(address);
    return NextResponse.json(geo);
  } catch (err) {
    return httpErrorFromException(err, "Geocoding failed");
  }
}
