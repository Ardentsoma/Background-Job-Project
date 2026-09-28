// src/worker/complete.ts
// DB state updates for marking jobs as succeeded, failed, or dead.

import { pool } from "../db";
import { maxAttempts } from "../config";
import { logEvent } from "./logger";
import { Job } from "../types";

/**
 * Marks a job as succeeded.
 * Includes a guard on id, status, and attempts to prevent stale updates.
 */
export async function markSucceeded(jobId: string, attempts: number): Promise<boolean> {
  // The WHERE guard checks id, status = 'processing', AND attempts match the attempt count at claim time.
  // This prevents a slow or stalled worker from overwriting state if a stuck job was already reclaimed and reassigned to another worker.
  const query = `
    UPDATE jobs
    SET status = 'succeeded',
        finished_at = now(),
        updated_at = now()
    WHERE id = $1 AND status = 'processing' AND attempts = $2;
  `;

  const result = await pool.query(query, [jobId, attempts]);

  if (result.rowCount === 0) {
    logEvent("job_stale_result_ignored", { jobId, attempts, reason: "Job was reclaimed by another worker or state changed" });
    return false;
  }

  return true;
}

export interface MarkFailedOrDeadResult {
  status: "failed" | "dead" | "stale";
  nextRunAt?: Date;
}

/**
 * Marks a job as failed (scheduled for retry) or dead (max attempts reached).
 * Truncates error message to 1000 chars.
 * Uses database clock to calculate retry run_at.
 */
export async function markFailedOrDead(
  jobId: string,
  attempts: number,
  errorMessage: string,
  delayMs: number
): Promise<MarkFailedOrDeadResult> {
  const truncatedError = errorMessage.slice(0, 1000);
  const isDead = attempts >= maxAttempts;

  if (isDead) {
    // The WHERE guard checks id, status = 'processing', AND attempts match the attempt count at claim time.
    // This prevents a slow or stalled worker from overwriting state if a stuck job was already reclaimed and reassigned to another worker.
    const deadQuery = `
      UPDATE jobs
      SET status = 'dead',
          last_error = $3,
          finished_at = now(),
          updated_at = now()
      WHERE id = $1 AND status = 'processing' AND attempts = $2;
    `;

    const result = await pool.query(deadQuery, [jobId, attempts, truncatedError]);

    if (result.rowCount === 0) {
      logEvent("job_stale_result_ignored", { jobId, attempts, reason: "Job was reclaimed by another worker or state changed" });
      return { status: "stale" };
    }

    return { status: "dead" };
  } else {
    // Calculate retry timestamp on DB server so all workers agree on time
    const failQuery = `
      UPDATE jobs
      SET status = 'failed',
          last_error = $3,
          run_at = now() + ($4 * interval '1 millisecond'),
          updated_at = now()
      WHERE id = $1 AND status = 'processing' AND attempts = $2
      RETURNING run_at;
    `;

    const result = await pool.query<Job>(failQuery, [jobId, attempts, truncatedError, delayMs]);

    if (result.rowCount === 0) {
      logEvent("job_stale_result_ignored", { jobId, attempts, reason: "Job was reclaimed by another worker or state changed" });
      return { status: "stale" };
    }

    return {
      status: "failed",
      nextRunAt: result.rows[0].run_at,
    };
  }
}
