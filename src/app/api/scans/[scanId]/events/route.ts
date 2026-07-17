import { requireScanAccess } from "@/lib/auth/api-auth";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { createServiceClient } from "@/lib/db/client";
import { SCAN_POLL_STATUSES } from "@/lib/scans/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated SSE progress stream for one scan the caller can access.
 * Postgres remains the source of truth; events are derived from throttled reads.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await context.params;

  try {
    await requireScanAccess(scanId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied";
    return new Response(JSON.stringify({ error: message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const supabase = createServiceClient();

  const stream = new ReadableStream({
    start(controller) {
      let interval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("ready", { scanId });

      const tick = async () => {
        if (closed) return;
        const { data: batch } = await supabase
          .from("scan_batches")
          .select(
            "id, status, cells_completed, cells_total, cells_failed, finished_at, heartbeat_at"
          )
          .eq("id", scanId)
          .maybeSingle();

        if (!batch) {
          send("error", { message: "Scan not found" });
          cleanup();
          return;
        }

        send("progress", {
          scanId: batch.id,
          status: batch.status,
          cellsCompleted: batch.cells_completed,
          cellsTotal: batch.cells_total,
          cellsFailed: batch.cells_failed,
          updatedAt: batch.heartbeat_at ?? batch.finished_at ?? null,
        });

        const status = String(batch.status);
        if (!SCAN_POLL_STATUSES.has(status)) {
          send("done", { status });
          cleanup();
        }
      };

      interval = setInterval(() => {
        void tick();
      }, 2000);
      void tick();

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
