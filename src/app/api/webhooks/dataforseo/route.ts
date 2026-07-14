import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processProviderTaskResult } from "@/lib/jobs/process-scan";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";

function authorizeWebhook(request: Request): NextResponse | null {
  const secret = process.env.DATAFORSEO_WEBHOOK_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json(
        { error: "DATAFORSEO_WEBHOOK_SECRET is not configured" },
        { status: 503 }
      );
    }
  } else if (!secret) {
    // Local/dev: allow unauthenticated for legacy DFS testing when unset.
    return null;
  }

  const header =
    request.headers.get("x-webhook-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const urlToken = new URL(request.url).searchParams.get("token")?.trim();
  if (header !== secret && urlToken !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function markProviderTaskFailed(tag: string, statusCode: number): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("scan_provider_tasks")
    .update({
      status: "failed",
      result_json: { error: true, status_code: statusCode },
    })
    .eq("tag", tag);

  const parts = tag.split(":");
  const scanBatchId = parts[0];
  if (!scanBatchId) return;

  const { data: pending } = await supabase
    .from("scan_provider_tasks")
    .select("id")
    .eq("scan_batch_id", scanBatchId)
    .eq("status", "pending");

  if ((pending ?? []).length === 0) {
    const { data: allTasks } = await supabase
      .from("scan_provider_tasks")
      .select("status")
      .eq("scan_batch_id", scanBatchId);
    const failed = (allTasks ?? []).filter((t) => t.status === "failed").length;
    const total = (allTasks ?? []).length;
    await finalizeRankReady(scanBatchId, undefined, failed, total);
  }
}

export async function POST(request: Request) {
  const denied = authorizeWebhook(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const tasks = (body.tasks ?? [body]) as Array<{
      id?: string;
      tag?: string;
      status_code?: number;
      result?: Array<{
        items?: unknown[];
        check_url?: string;
        datetime?: string;
      }>;
    }>;

    for (const task of tasks) {
      const tag = task.tag ?? (body.tag as string | undefined);
      if (!tag) continue;

      const result = task.result?.[0];
      const items = result?.items ?? [];

      if (task.status_code && task.status_code >= 40000) {
        console.error("[DataForSEO] Webhook task error:", {
          tag,
          taskId: task.id,
          statusCode: task.status_code,
        });
        await markProviderTaskFailed(tag, task.status_code);
        continue;
      }

      if (!items.length) {
        console.warn("[DataForSEO] Webhook OK but 0 items:", { tag, taskId: task.id });
      }

      await processProviderTaskResult({
        tag,
        items,
        checkUrl: result?.check_url,
        timestamp: result?.datetime,
      });
    }

    return NextResponse.json({ received: true, processed: tasks.length });
  } catch (err) {
    console.error("DataForSEO webhook error:", err);
    return NextResponse.json({ received: true, error: String(err) });
  }
}
