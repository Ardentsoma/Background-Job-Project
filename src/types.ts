// src/types.ts
// Shared types for the job system.
// These mirror the jobs table in the database.

/** The five allowed job statuses, matching the CHECK constraint in the jobs table */
export type JobStatus = "pending" | "processing" | "succeeded" | "failed" | "dead";

/** A row from the jobs table */
export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}
