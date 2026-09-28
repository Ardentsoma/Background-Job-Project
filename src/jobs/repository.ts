// src/jobs/repository.ts
// Database repository containing SQL queries for jobs.
// Keeps all SQL isolated from HTTP route handlers.

import { pool } from "../db";
import { Job } from "../types";
import { maxAttempts } from "../config";

export interface InsertJobResult {
  job: Job;
  duplicate: boolean;
}

export type RetryDeadJobResult =
  | { status: "retried"; job: Job }
  | { status: "not_found"; job: null }
  | { status: "not_dead"; job: null };

/**
 * Inserts a job row atomically using ON CONFLICT DO NOTHING.
 * If inserted, returns duplicate = false.
 * If conflict occurred, fetches the existing row and returns duplicate = true.
 */
export async function createOrGetJob(
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<InsertJobResult> {
  const insertQuery = `
    INSERT INTO jobs (type, payload, max_attempts, idempotency_key)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING *;
  `;

  const insertResult = await pool.query<Job>(insertQuery, [
    type,
    JSON.stringify(payload),
    maxAttempts,
    idempotencyKey,
  ]);

  if (insertResult.rows.length > 0) {
    return { job: insertResult.rows[0], duplicate: false };
  }

  // Key already existed due to conflict, fetch existing job row
  const selectQuery = `
    SELECT * FROM jobs WHERE idempotency_key = $1;
  `;
  const selectResult = await pool.query<Job>(selectQuery, [idempotencyKey]);

  return { job: selectResult.rows[0], duplicate: true };
}

/**
 * Fetches a single job by UUID id.
 */
export async function findJobById(id: string): Promise<Job | null> {
  const query = `
    SELECT * FROM jobs WHERE id = $1;
  `;
  const result = await pool.query<Job>(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Fetches up to `limit` dead jobs, newest finished first.
 */
export async function getDeadJobs(limit = 50): Promise<Job[]> {
  const query = `
    SELECT * FROM jobs
    WHERE status = 'dead'
    ORDER BY finished_at DESC
    LIMIT $1;
  `;
  const result = await pool.query<Job>(query, [limit]);
  return result.rows;
}

/**
 * Resets a dead job back to pending state for retry.
 * Leaves last_error intact so history remains visible until next attempt.
 */
export async function retryDeadJob(id: string): Promise<RetryDeadJobResult> {
  const updateQuery = `
    UPDATE jobs
    SET status = 'pending', attempts = 0, run_at = now(),
        finished_at = NULL, updated_at = now()
    WHERE id = $1 AND status = 'dead'
    RETURNING *;
  `;

  const updateResult = await pool.query<Job>(updateQuery, [id]);

  if (updateResult.rows.length > 0) {
    return { status: "retried", job: updateResult.rows[0] };
  }

  // Check if job exists at all to differentiate 404 NOT_FOUND vs 409 NOT_DEAD
  const checkQuery = `SELECT status FROM jobs WHERE id = $1;`;
  const checkResult = await pool.query(checkQuery, [id]);

  if (checkResult.rows.length === 0) {
    return { status: "not_found", job: null };
  }

  return { status: "not_dead", job: null };
}
