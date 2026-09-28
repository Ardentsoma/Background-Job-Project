// src/worker/claim.ts
// Atomic SQL query for claiming a job ready for execution.

import { pool } from "../db";
import { Job } from "../types";

/**
 * Claims a single eligible job from the queue in an atomic SQL statement.
 * Returns the claimed Job or null if no claimable job exists.
 */
export async function claimJob(): Promise<Job | null> {
  // FOR UPDATE locks the chosen row so no other transaction can modify it.
  // SKIP LOCKED makes concurrent workers skip already-locked rows instantly instead of waiting.
  // The outer UPDATE flips the status to 'processing' and increments attempts in the exact same statement,
  // guaranteeing that two workers can never claim or process the same job row.
  const query = `
    UPDATE jobs
    SET status = 'processing',
        attempts = attempts + 1,
        started_at = now(),
        updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status IN ('pending', 'failed')
        AND run_at <= now()
        AND attempts < max_attempts
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;

  const result = await pool.query<Job>(query);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
