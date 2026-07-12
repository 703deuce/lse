import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { type PlanId, resetOrganizationUsage, setOrganizationPlan } from "@/lib/plans";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as { planId?: PlanId };
    if (!body.planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    await setOrganizationPlan(id, body.planId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as { action?: string };
    if (body.action !== "reset-usage") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    await resetOrganizationUsage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
