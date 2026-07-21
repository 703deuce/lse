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
`https://` URL.

## Update every Coolify resource that runs this repo

Open **each** of these (if they exist) → Environment Variables:

| Resource | Why |
| --- | --- |
| Main web app (`app.localseoexpress.com`) | Cron `POST /api/jobs/process`, enqueue, rate limits |
| Maps / combined worker (`worker:all` or `worker:maps`) | BullMQ consumers |
| Messaging worker (`worker:messaging`) | Campaign email/sms queues |
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

## Repo check

There is **no** hardcoded retired hostname in Dockerfiles or compose files.
All Redis clients go through `getRedisUrl()` in `src/lib/queue/config.ts`.
