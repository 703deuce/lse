# Supabase Edge Functions (optional deployment)

These mirror the Next.js job handlers. Deploy when you want background work off the Next server:

- `dispatch-scans` — POST queued standard scans to DataForSEO in batches
- `process-scan` — wraps `processScanBatch` for long-running live scans
- `process-audit` — re-run deterministic audit on an existing scan
- `generate-report` — scheduled monthly report generation

For MVP, jobs run via `/api/jobs/process` and inline processing on scan create.
