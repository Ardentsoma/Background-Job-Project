// src/worker/sweep.ts
// Recovers jobs left stuck in 'processing' state when a worker crashes or dies unexpectedly.
// Atomic SQL update executed periodically by worker processes.

import { pool } from "../db";
import { stuckTimeoutMs } from "../config";
import { logEvent } from "./logger";

export interface RecoveredJob {
  id: string;
  status: string;
  attempts: number;
}

/**
 * Sweeps the database for processing jobs whose started_at timestamp is older than stuckTimeoutMs.
 * The stuckTimeoutMs threshold MUST be set longer than the maximum expected execution time of any real job;
 * otherwise, an active job that is simply running slowly could be incorrectly marked as failed/dead while still processing.
 */
export async function recoverStuckJobs(): Promise<RecoveredJob[]> {
  const query = `
    UPDATE jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'failed' END,
        finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE finished_at END,
        last_error = 'Recovered: worker stopped responding during processing',
        run_at = now(),
        updated_at = now()
    WHERE status = 'processing'
      AND started_at < now() - ($1 * interval '1 millisecond')
    RETURNING id, status, attempts;
  `;

  const result = await pool.query<RecoveredJob>(query, [stuckTimeoutMs]);

  for (const row of result.rows) {
    logEvent("sweep_recovered", {
      jobId: row.id,
      status: row.status,
      attempts: row.attempts,
    });
  }

  return result.rows;
}
