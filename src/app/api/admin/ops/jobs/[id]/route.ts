import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { cancelJob, getJobStatus, retryJob } from "@/lib/queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { id } = await params;
    const job = await getJobStatus(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
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
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action;

    if (action === "cancel") {
      const ok = await cancelJob(id);
      if (!ok) return NextResponse.json({ error: "Job not cancelable" }, { status: 409 });
      return NextResponse.json({ ok: true, action: "cancel" });
    }

    if (action === "retry") {
      const ok = await retryJob(id);
      if (!ok) return NextResponse.json({ error: "Job not retryable" }, { status: 409 });
      return NextResponse.json({ ok: true, action: "retry" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
