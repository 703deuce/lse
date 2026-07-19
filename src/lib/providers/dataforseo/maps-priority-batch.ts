/**
 * DataForSEO Google Maps Priority (queued) batch client.
 *
 * Submit up to 100 tasks per POST with priority=2, then poll task_get until
 * ready. Used for grid scans so all pins can be fired at once without Live
 * synchronous waits.
 */

import {
  buildMapsLiveRequest,
  mapsLiveRequestBody,
} from "@/lib/providers/dataforseo/build-maps-request";
import {
  dataForSeoGet,
  dataForSeoRequest,
  isDataForSeoQueueStatus,
} from "@/lib/providers/dataforseo/client";
import type { MapsLiveResult, MapsLiveResponse } from "@/lib/providers/dataforseo/index";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { dataForSeoMapsMaxTasksPerPost } from "@/lib/providers/maps-grid/config";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";

/** DataForSEO tags: keep alphanumeric + hyphen/underscore (no raw UUID colons). */
export function sanitizeMapsTaskTag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 255);
}

/** Keep organic/paid Maps listings; drop refinement chips and other noise. */
export function normalizeMapsSerpItems(items: MapsLiveResult[] | null | undefined): MapsLiveResult[] {
  if (!items?.length) return [];
  const filtered = items.filter((item) => {
    const t = item.type;
    return !t || t === "maps_search" || t === "maps_paid_item";
  });
  return filtered.length ? filtered : items;
}

export const MAPS_TASK_POST_ENDPOINT = "serp/google/maps/task_post";
export const MAPS_TASK_GET_ADVANCED_PREFIX = "serp/google/maps/task_get/advanced";

/** High priority — ~1 minute average per DataForSEO docs. */
export const DATAFORSEO_MAPS_PRIORITY_HIGH = 2;

export type MapsPriorityCellInput = {
  /** Stable id used as DataForSEO `tag` and result key. */
  tag: string;
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth: number;
  languageCode?: string;
  zoom?: number;
  searchThisArea?: boolean;
};

export type MapsPriorityCellResult = {
  tag: string;
  taskId: string | null;
  ok: boolean;
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: ReturnType<typeof buildMapsLiveRequest> & { priority: number };
  taskStatus?: number | null;
  taskMessage?: string | null;
  errorMessage?: string;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function buildPriorityTaskBody(cell: MapsPriorityCellInput) {
  const profile = {
    device: cell.device,
    os: cell.os,
    browser: cell.browser,
  };
  const request = buildMapsLiveRequest({
    keyword: cell.keyword,
    lat: cell.lat,
    lng: cell.lng,
    profile,
    depth: cell.depth,
    languageCode: cell.languageCode ?? LOCAL_FALCON_PARITY.languageCode,
    zoom: cell.zoom ?? LOCAL_FALCON_PARITY.locationZoom,
    // Always keep search-this-area for Local Falcon parity grids.
    searchThisArea: cell.searchThisArea ?? LOCAL_FALCON_PARITY.searchThisArea,
    searchPlaces: LOCAL_FALCON_PARITY.searchPlaces,
    seDomain: LOCAL_FALCON_PARITY.seDomain,
  });
  const body = {
    ...mapsLiveRequestBody(request),
    priority: DATAFORSEO_MAPS_PRIORITY_HIGH,
    tag: sanitizeMapsTaskTag(cell.tag),
  };
  return {
    body,
    request: { ...request, priority: DATAFORSEO_MAPS_PRIORITY_HIGH as number },
  };
}

export type PostedMapsPriorityTask = {
  tag: string;
  taskId: string;
  request: MapsPriorityCellResult["request"];
};

/**
 * Fire-and-forget style submit: post all cells immediately in chunks of ≤100.
 * No sleep between POSTs — DataForSEO queues the work.
 */
export async function postMapsPriorityTasks(
  cells: MapsPriorityCellInput[],
  organizationId?: string
): Promise<PostedMapsPriorityTask[]> {
  if (!cells.length) return [];

  const maxPerPost = dataForSeoMapsMaxTasksPerPost();
  // Always key by the sanitized tag we actually send — task_post echoes that.
  const prepared = cells.map((cell) => {
    const { body, request } = buildPriorityTaskBody(cell);
    const tag = sanitizeMapsTaskTag(cell.tag);
    return { tag, body: { ...body, tag }, request };
  });

  const posted: PostedMapsPriorityTask[] = [];
  const chunks = chunkArray(prepared, maxPerPost);

  // Submit every chunk back-to-back — no inter-batch wait.
  for (const chunk of chunks) {
    const data = await dataForSeoRequest<{
      tasks?: Array<{
        id?: string;
        status_code?: number;
        status_message?: string;
        data?: { tag?: string };
      }>;
    }>(
      MAPS_TASK_POST_ENDPOINT,
      chunk.map((c) => c.body),
      organizationId
    );

    const byTag = new Map(chunk.map((c) => [c.tag, c] as const));
    for (const task of data.tasks ?? []) {
      const tag = sanitizeMapsTaskTag(String(task.data?.tag ?? ""));
      const preparedRow = byTag.get(tag);
      if (!task.id || !preparedRow) continue;
      posted.push({
        tag: preparedRow.tag,
        taskId: task.id,
        request: preparedRow.request,
      });
    }

    // Fallback: zip by index when tag echo is missing.
    if ((data.tasks ?? []).length === chunk.length && posted.length < chunk.length) {
      chunk.forEach((row, idx) => {
        if (posted.some((p) => p.tag === row.tag)) return;
        const taskId = data.tasks?.[idx]?.id;
        if (!taskId) return;
        posted.push({ tag: row.tag, taskId, request: row.request });
      });
    }
  }

  if (posted.length !== cells.length) {
    console.warn(
      `[DataForSEO] Priority post mapped ${posted.length}/${cells.length} tasks (some tags missing)`
    );
  }

  return posted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dataForSeoPriorityPollIntervalMs(): number {
  const n = Number(process.env.DATAFORSEO_MAPS_PRIORITY_POLL_MS ?? 4000);
  return Number.isFinite(n) && n >= 500 ? Math.min(n, 30_000) : 4000;
}

export function dataForSeoPriorityPollTimeoutMs(): number {
  const n = Number(process.env.DATAFORSEO_MAPS_PRIORITY_POLL_TIMEOUT_MS ?? 180_000);
  return Number.isFinite(n) && n >= 15_000 ? Math.min(n, 600_000) : 180_000;
}

type PolledTask = {
  taskId: string;
  statusCode: number | null;
  statusMessage: string | null;
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  done: boolean;
  failed: boolean;
};

async function getMapsTaskAdvanced(
  taskId: string,
  organizationId?: string
): Promise<PolledTask> {
  const data = await dataForSeoGet<MapsLiveResponse>(
    `${MAPS_TASK_GET_ADVANCED_PREFIX}/${taskId}`,
    organizationId,
    { quietQueue: true }
  );
  const task = data.tasks?.[0];
  const statusCode = task?.status_code ?? null;
  const statusMessage = task?.status_message ?? null;
  const result = task?.result?.[0] as
    | {
        items?: MapsLiveResult[];
        items_count?: number;
        check_url?: string;
        datetime?: string;
      }
    | undefined;
  const items = normalizeMapsSerpItems(result?.items);

  const queued = isDataForSeoQueueStatus(statusCode);
  const hardFail = statusCode != null && statusCode >= 40000 && !queued;
  // 20000 = Ok / Task Ready. Do not treat a non-20000 partial payload as done.
  const ready = statusCode === 20000;

  return {
    taskId,
    statusCode,
    statusMessage,
    items,
    checkUrl: result?.check_url,
    timestamp: result?.datetime,
    done: ready || hardFail,
    failed: hardFail,
  };
}

/**
 * Poll all task IDs until each is ready/failed or the timeout elapses.
 * GETs run in parallel each tick — no drip-feed.
 */
export async function pollMapsPriorityTasks(
  taskIds: string[],
  organizationId?: string,
  options?: { pollIntervalMs?: number; timeoutMs?: number }
): Promise<Map<string, PolledTask>> {
  const pending = new Set(taskIds.filter(Boolean));
  const finished = new Map<string, PolledTask>();
  if (!pending.size) return finished;

  const intervalMs = options?.pollIntervalMs ?? dataForSeoPriorityPollIntervalMs();
  const timeoutMs = options?.timeoutMs ?? dataForSeoPriorityPollTimeoutMs();
  const deadline = Date.now() + timeoutMs;

  while (pending.size > 0 && Date.now() < deadline) {
    const ids = [...pending];
    const results = await Promise.all(
      ids.map((id) =>
        getMapsTaskAdvanced(id, organizationId).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          return {
            taskId: id,
            statusCode: null,
            statusMessage: message,
            items: [] as MapsLiveResult[],
            done: false,
            failed: false,
          } satisfies PolledTask;
        })
      )
    );

    for (const row of results) {
      if (!row.done) continue;
      finished.set(row.taskId, row);
      pending.delete(row.taskId);
    }

    if (pending.size === 0) break;
    await sleep(intervalMs);
  }

  for (const id of pending) {
    finished.set(id, {
      taskId: id,
      statusCode: null,
      statusMessage: "Priority task poll timed out",
      items: [],
      done: true,
      failed: true,
    });
  }

  return finished;
}

/**
 * Submit all cells via Priority, then retrieve finished tasks.
 * Does not enforce items>=depth — callers validate.
 */
export async function runMapsPriorityBatch(
  cells: MapsPriorityCellInput[],
  organizationId?: string,
  options?: { pollIntervalMs?: number; timeoutMs?: number }
): Promise<MapsPriorityCellResult[]> {
  if (!cells.length) return [];

  const byTag = new Map(
    cells.map((c) => [sanitizeMapsTaskTag(c.tag), c] as const)
  );
  console.log(
    `[DataForSEO] Priority batch submit: ${cells.length} tasks (max ${dataForSeoMapsMaxTasksPerPost()}/POST, priority=${DATAFORSEO_MAPS_PRIORITY_HIGH}, search_this_area=${LOCAL_FALCON_PARITY.searchThisArea}, search_places=${LOCAL_FALCON_PARITY.searchPlaces})`
  );

  const posted = await postMapsPriorityTasks(cells, organizationId);
  const postedByTag = new Map(posted.map((p) => [p.tag, p] as const));

  const polled = await pollMapsPriorityTasks(
    posted.map((p) => p.taskId),
    organizationId,
    options
  );

  const results: MapsPriorityCellResult[] = [];
  for (const cell of cells) {
    const tag = sanitizeMapsTaskTag(cell.tag);
    const post = postedByTag.get(tag);
    const { request } = buildPriorityTaskBody(cell);

    if (!post) {
      results.push({
        tag,
        taskId: null,
        ok: false,
        items: [],
        request,
        errorMessage: "DataForSEO Priority task_post did not return a task id",
      });
      continue;
    }

    const got = polled.get(post.taskId);
    if (!got) {
      results.push({
        tag,
        taskId: post.taskId,
        ok: false,
        items: [],
        request: post.request,
        errorMessage: "DataForSEO Priority task result missing after poll",
      });
      continue;
    }

    if (got.failed && !got.items.length) {
      results.push({
        tag,
        taskId: post.taskId,
        ok: false,
        items: [],
        request: post.request,
        taskStatus: got.statusCode,
        taskMessage: got.statusMessage,
        errorMessage: got.statusMessage ?? "DataForSEO Priority task failed",
      });
      continue;
    }

    results.push({
      tag,
      taskId: post.taskId,
      ok: got.statusCode === 20000,
      items: got.items,
      checkUrl: got.checkUrl,
      timestamp: got.timestamp,
      request: post.request,
      taskStatus: got.statusCode,
      taskMessage: got.statusMessage,
    });
  }

  const withItems = results.filter((r) => r.items.length > 0).length;
  const full = results.filter((r) => r.items.length >= (byTag.get(r.tag)?.depth ?? 20)).length;
  console.log(
    `[DataForSEO] Priority batch done: ${results.length} cells, ${withItems} with items, ${full} with full depth`
  );

  return results;
}

/**
 * Single-cell Priority helper (post one + poll). Used by adapters / keyword tracker.
 */
export async function mapsPriorityGridCell(params: {
  keyword: string;
  lat: number;
  lng: number;
  languageCode?: string;
  device?: string;
  os?: string;
  browser?: string;
  depth?: number;
  zoom?: number;
  organizationId?: string;
  tag?: string;
}): Promise<{
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: MapsPriorityCellResult["request"];
}> {
  const tag = params.tag ?? `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const depth = params.depth ?? LOCAL_FALCON_PARITY.gridDepth;
  const [result] = await runMapsPriorityBatch(
    [
      {
        tag,
        keyword: params.keyword,
        lat: params.lat,
        lng: params.lng,
        device: (params.device === "desktop" ? "desktop" : "mobile") as "mobile" | "desktop",
        os: (params.os ?? "android") as ScanDeviceProfile["os"],
        browser: (params.browser === "firefox" ? "firefox" : "chrome") as "chrome" | "firefox",
        depth,
        languageCode: params.languageCode,
        zoom: params.zoom,
        searchThisArea: LOCAL_FALCON_PARITY.searchThisArea,
      },
    ],
    params.organizationId
  );

  if (!result) {
    throw new Error("DataForSEO Priority returned no result for this cell");
  }
  if (!result.ok && !result.items.length) {
    throw new Error(result.errorMessage ?? "DataForSEO Priority task failed");
  }
  if (!result.items.length) {
    throw new Error("DataForSEO returned no map results for this cell");
  }
  if (result.items.length < depth) {
    throw new Error(
      `sparse SERP: ${result.items.length} results returned (need ${depth})`
    );
  }

  return {
    items: result.items,
    checkUrl: result.checkUrl,
    timestamp: result.timestamp,
    request: result.request,
  };
}
