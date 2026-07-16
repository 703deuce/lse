-- Idempotent usage/cost ledger writes (retries must not double-bill).
ALTER TABLE usage_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_ledger_idempotency
  ON usage_ledger (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN usage_ledger.idempotency_key IS
  'Stable key e.g. brightdata:maps_grid_cell:{scanBatchId}:{pointId}:{keywordId}';
