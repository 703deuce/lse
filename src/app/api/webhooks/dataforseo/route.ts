import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processProviderTaskResult } from "@/lib/jobs/process-scan";
import { finalizeRankReady } from "@/lib/jobs/finalize-scan";
import { authorizeHeaderSecret } from "@/lib/security/secrets";

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
  const authz = authorizeHeaderSecret(request, process.env.DATAFORSEO_WEBHOOK_SECRET);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

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
    console.error(
      "DataForSEO webhook error:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json({ received: true, error: "Webhook processing failed" });
  }
}
