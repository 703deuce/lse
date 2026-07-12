import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { listRuns } from "@/lib/maps-difficulty/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    const runs = await listRuns(auth.organizationId ?? null);
    return NextResponse.json({ runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
