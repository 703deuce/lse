# Coolify — Upstash Redis URL (required on every resource)

Scan reclaim logs (`[Scan] Cron reclaiming stale in-flight scan`) and BullMQ
errors that mention `1hv8gepn81e4s5mtmrjf9stv` / `lhv8gepn81e4s5mtmrjf9stv`
mean that resource is **still dialing the retired Redis host**. The code never
reached Upstash.

The app rewrites any non-current `*.upstash.io` host to
`dynamic-pipefish-176544.upstash.io`, but **Coolify must still set the correct
`REDIS_URL` on every running resource**, then **Redeploy** (not Restart).

## Target URL

```bash
REDIS_URL=rediss://default:YOUR_UPSTASH_TOKEN@dynamic-pipefish-176544.upstash.io:6379
```

Use the TCP / ioredis URL from the Upstash console (`rediss://`), not the REST
`https://` URL. Plain `redis://` against Upstash causes `read ECONNRESET`.

The app upgrades Upstash URLs to `rediss://` and strips a `/0` pathname, but
Coolify should still store the correct `rediss://` value.

## Update every Coolify resource that runs this repo

Open **each** of these (if they exist) → Environment Variables:

| Resource | Why |
| --- | --- |
| Main web app (`app.localseoexpress.com`) | Cron `POST /api/jobs/process`, enqueue, rate limits |
| Maps / combined worker (`worker:all` or `worker:maps`) | BullMQ consumers |
| Combined worker (`worker:all`) | All queues including campaign email/sms |
| Any other worker / background processor | Same `REDIS_URL` |

Search for and fix/remove:

- `REDIS_URL`
- `REDIS_HOST`
- `QUEUE_REDIS_URL`
- `CACHE_REDIS_URL`
- `BULLMQ_REDIS_URL`

Keep **one** active Redis URL: `REDIS_URL` pointing at `dynamic-pipefish-176544.upstash.io`.

### Coolify gotchas

1. Enable **Runtime Variable** — Coolify only injects runtime-enabled vars into
   the running container.
2. Saving env does **not** update a live container — **Redeploy** (prefer
   rebuild without cache if offered). Do not rely on Restart alone.
3. Locked secrets cannot be edited in Developer View — delete and re-add.
4. Check project-level / environment-level shared variables that may override
   the per-resource value.
5. After redeploy, open the resource terminal:

```bash
printenv REDIS_URL | sed 's#://default:[^@]*@#://default:****@#'
```

Expected host: `dynamic-pipefish-176544.upstash.io`.

Worker / cron logs should also show:

```text
[redis] worker:all: source=REDIS_URL rawHost=… resolvedHost=dynamic-pipefish-176544.upstash.io url=rediss://default:****@dynamic-pipefish-176544.upstash.io:6379
```

If `rawHost` is still the old id but `resolvedHost` is dynamic-pipefish, the
code rewrite is active — still replace Coolify `REDIS_URL` so password/token
matches the new database.

## Redis MISCONF / stop-writes-on-bgsave-error

If Run buttons or Coolify show:

```text
MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk.
Commands that may modify the data set are disabled (stop-writes-on-bgsave-error).
```

This is **not an application bug**. The Redis instance (usually Coolify’s bundled
Redis) cannot write its RDB snapshot — often **disk full**, **wrong permissions**
on the Redis data directory, or a **failed background save**.

### Fix the Redis server (recommended)

On the **Redis** Coolify resource → Terminal:

```bash
df -h
redis-cli INFO persistence | grep -E 'rdb_last_bgsave_status|aof_last_write_status'
redis-cli CONFIG GET dir
```

- Free disk space on the host/volume, or fix permissions on the `dir` path.
- Check Redis container logs in Coolify for the exact `bgsave` error.
- After the root cause is fixed, writes resume automatically.

**Temporary only** (do not rely on this long-term):

```bash
redis-cli CONFIG SET stop-writes-on-bgsave-error no
```

### Use Upstash instead of Coolify Redis

Managed Redis avoids local disk snapshot issues. Set `REDIS_URL` to Upstash
`rediss://…@dynamic-pipefish-176544.upstash.io:6379` on **web + every worker**,
then **Redeploy** (see sections above).

### Immediate unblock without fixing Redis (database queue)

Until Redis accepts writes again, set on the **web app** only:

```bash
QUEUE_DRIVER=database
```

Redeploy the web app. Enqueues write to Postgres `job_queue` only (no BullMQ
Redis write). Cron `POST /api/jobs/process` and Next.js `after()` run jobs.
Workers stay idle until you flip back to `QUEUE_DRIVER=bullmq` with healthy Redis.

## Repo check

There is **no** hardcoded retired hostname in Dockerfiles or compose files.
All Redis clients go through `getRedisUrl()` in `src/lib/queue/config.ts`.
