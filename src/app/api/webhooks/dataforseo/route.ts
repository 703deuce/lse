import { NextResponse } from "next/server";
import { processProviderTaskResult } from "@/lib/jobs/process-scan";

export async function POST(request: Request) {
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
          body: JSON.stringify(task),
        });
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
