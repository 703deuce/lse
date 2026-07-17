import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireInternalMapsDifficulty } from "@/lib/auth/plan-guards";
import { listRuns } from "@/lib/maps-difficulty/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    await requireInternalMapsDifficulty(auth.organizationId);
    const runs = await listRuns(auth.organizationId ?? null);
    return NextResponse.json({ runs });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load history");
  }
}
