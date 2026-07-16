-- Allow AI Visibility runs/engines to finish with partial success statuses.

ALTER TABLE ai_visibility_runs
  DROP CONSTRAINT IF EXISTS ai_visibility_runs_status_check;

ALTER TABLE ai_visibility_runs
  ADD CONSTRAINT ai_visibility_runs_status_check
  CHECK (status IN ('running', 'complete', 'completed_with_errors', 'failed'));

ALTER TABLE ai_visibility_engine_results
  DROP CONSTRAINT IF EXISTS ai_visibility_engine_results_status_check;

ALTER TABLE ai_visibility_engine_results
  ADD CONSTRAINT ai_visibility_engine_results_status_check
  CHECK (
    status IN (
      'complete',
      'failed',
      'skipped',
      'rate_limited',
      'timed_out',
      'provider_failed',
      'unsupported'
    )
  );
