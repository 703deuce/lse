import { requirePlatformAdmin } from "@/lib/auth/admin";
import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { cancelJob, getJobStatus, retryJob } from "@/lib/queue";
import { reconcileCompletedMapsJobScanMismatch } from "@/lib/jobs/queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    const { id } = await params;
    const job = await getJobStatus(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
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

    if (action === "reconcile-mismatch") {
      // id may be "_" for bulk; always runs the same mismatch fixer.
      const fixed = await reconcileCompletedMapsJobScanMismatch(20);
      return NextResponse.json({ ok: true, action: "reconcile-mismatch", fixed, jobId: id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
