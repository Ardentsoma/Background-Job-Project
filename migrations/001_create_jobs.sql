-- Task 2: background jobs
-- Run once against a fresh Neon database.

CREATE TABLE jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL,
  payload          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL,
  last_error       text,
  run_at           timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- same logical job can never be created twice
  CONSTRAINT jobs_idempotency_key_unique UNIQUE (idempotency_key),

  -- only the five allowed states
  CONSTRAINT jobs_status_valid
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'dead')),

  -- sane counters
  CONSTRAINT jobs_max_attempts_positive CHECK (max_attempts >= 1),
  CONSTRAINT jobs_attempts_in_range CHECK (attempts >= 0 AND attempts <= max_attempts),

  -- a processing job must say when it started
  CONSTRAINT jobs_processing_has_start
    CHECK (status <> 'processing' OR started_at IS NOT NULL),

  -- finished jobs must say when they finished
  CONSTRAINT jobs_finished_has_end
    CHECK (status NOT IN ('succeeded', 'dead') OR finished_at IS NOT NULL)
);

-- One row per email actually sent. The unique job_id is the
-- second layer against double sends (Resend's key is the first).
CREATE TABLE email_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               uuid NOT NULL REFERENCES jobs(id),
  recipient            text NOT NULL,
  provider_message_id  text NOT NULL,
  sent_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_deliveries_job_unique UNIQUE (job_id)
);

-- Worker claim query: jobs ready to run
CREATE INDEX jobs_claimable_idx
  ON jobs (run_at)
  WHERE status IN ('pending', 'failed');

-- Stuck job sweep: find old processing rows
CREATE INDEX jobs_processing_idx
  ON jobs (started_at)
  WHERE status = 'processing';

-- Dead letter view: newest dead jobs first
CREATE INDEX jobs_dead_idx
  ON jobs (finished_at DESC)
  WHERE status = 'dead';
