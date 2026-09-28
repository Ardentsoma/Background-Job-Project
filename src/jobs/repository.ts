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
