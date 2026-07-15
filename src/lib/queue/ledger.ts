import { createServiceClient } from "@/lib/db/client";
import type {
  EnqueueJobInput,
  EnqueueState,
  QueueJobRecord,
} from "@/lib/queue/types";
import { PRIORITY_SCORES } from "@/lib/queue/types";

function priorityScore(priority: EnqueueJobInput["priority"]): number {
  if (typeof priority === "number" && Number.isFinite(priority)) return priority;
  if (priority === "highest" || priority === "normal" || priority === "lower") {
    return PRIORITY_SCORES[priority];
  }
  return PRIORITY_SCORES.normal;
}

export async function findJobByIdempotencyKey(
  idempotencyKey: string
): Promise<QueueJobRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return rowToRecord(data);
}

export async function createLedgerJob(input: EnqueueJobInput): Promise<QueueJobRecord> {
  const supabase = createServiceClient();
  const scheduledAt = new Date(Date.now() + (input.delayMs ?? 0)).toISOString();
  const { data, error } = await supabase
    .from("job_queue")
    .insert({
      job_type: input.jobType,
      payload: input.payload,
      status: "pending",
      organization_id: input.organizationId ?? null,
      business_id: input.businessId ?? null,
      queue_name: input.queueName,
      priority: priorityScore(input.priority),
      idempotency_key: input.idempotencyKey ?? null,
      max_attempts: input.maxAttempts ?? 3,
      scheduled_at: scheduledAt,
      enqueue_state: "pending",
      cost_estimate: input.costEstimate ?? null,
      progress_json: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    // Unique idempotency race — return existing.
    if (input.idempotencyKey && /duplicate|unique/i.test(error?.message ?? "")) {
      const existing = await findJobByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }
    throw new Error(error?.message ?? "Failed to create job ledger row");
  }
  return rowToRecord(data);
}

export async function markLedgerEnqueued(
  jobId: string,
  opts: { queueJobId?: string | null; enqueueState?: EnqueueState } = {}
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      enqueue_state: opts.enqueueState ?? "enqueued",
      queue_job_id: opts.queueJobId ?? jobId,
    })
    .eq("id", jobId);
}

export async function markLedgerEnqueueFailed(jobId: string, message: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      enqueue_state: "enqueue_failed",
      error_message: message,
      error_code: "enqueue_failed",
    })
    .eq("id", jobId);
}

export async function updateJobProgress(
  jobId: string,
  progress: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      progress_json: progress,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function heartbeatJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function getLedgerJob(jobId: string): Promise<QueueJobRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("job_queue").select("*").eq("id", jobId).maybeSingle();
  if (!data) return null;
  return rowToRecord(data);
}

export async function listEnqueueFailedJobs(limit = 20): Promise<QueueJobRecord[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("*")
    .eq("enqueue_state", "enqueue_failed")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map(rowToRecord);
}

function rowToRecord(data: Record<string, unknown>): QueueJobRecord {
  return {
    id: String(data.id),
    queueName: (data.queue_name as QueueJobRecord["queueName"]) ?? null,
    jobType: String(data.job_type),
    payload: (data.payload as Record<string, unknown>) ?? {},
    status: String(data.status),
    enqueueState: (data.enqueue_state as EnqueueState) ?? "pending",
    organizationId: (data.organization_id as string | null) ?? null,
    businessId: (data.business_id as string | null) ?? null,
    priority: Number(data.priority ?? 50),
    attempts: Number(data.attempts ?? 0),
    maxAttempts: Number(data.max_attempts ?? 3),
    progress: (data.progress_json as Record<string, unknown>) ?? {},
    errorMessage: (data.error_message as string | null) ?? null,
    scheduledAt: String(data.scheduled_at),
    startedAt: (data.started_at as string | null) ?? null,
    finishedAt: (data.finished_at as string | null) ?? null,
    heartbeatAt: (data.heartbeat_at as string | null) ?? null,
  };
}
