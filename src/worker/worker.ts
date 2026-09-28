// src/worker/worker.ts
// Main worker process entry point and polling loop.
// Claims jobs, executes handlers up to the concurrency limit, handles backoff, and shuts down gracefully.

import { pool } from "../db";
import {
  concurrency,
  pollIntervalMs,
  maxAttempts,
  emailMode,
  backoffBaseMs,
  backoffJitterMs,
} from "../config";
import { claimJob } from "./claim";
import { markFailedOrDead } from "./complete";
import { computeBackoffMs } from "./backoff";
import { logEvent } from "./logger";
import { handlers } from "./handlers";
import { Job } from "../types";

let inFlight = 0;
let isStopping = false;

/**
 * Executes a single job through its registered handler.
 * Handles failure retries, backoff, and event logging.
 */
async function processJob(job: Job): Promise<void> {
  const handler = handlers[job.type];

  try {
    if (!handler) {
      throw new Error(`No registered handler for job type: ${job.type}`);
    }

    await handler(job);
    logEvent("job_succeeded", { jobId: job.id, inFlight });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const delayMs = computeBackoffMs(job.attempts);

    const result = await markFailedOrDead(job.id, job.attempts, errorMessage, delayMs);

    if (result.status === "dead") {
      logEvent("job_dead", { jobId: job.id, attempts: job.attempts, error: errorMessage });
    } else if (result.status === "failed") {
      logEvent("job_failed", {
        jobId: job.id,
        attempts: job.attempts,
        delayMs,
        nextRunAt: result.nextRunAt,
        error: errorMessage,
      });
    }
  } finally {
    inFlight--;
  }
}

/**
 * Main polling loop. Claims jobs while in-flight count is under concurrency limit.
 */
async function startLoop(): Promise<void> {
  logEvent("worker_started", {
    concurrency,
    pollIntervalMs,
    maxAttempts,
    emailMode,
    backoffBaseMs,
    backoffJitterMs,
  });

  while (!isStopping) {
    while (!isStopping && inFlight < concurrency) {
      try {
        const job = await claimJob();
        if (!job) {
          break; // No job available right now
        }

        if (isStopping) {
          // Worker received shutdown signal while query was executing; release job back to pending
          await pool.query(
            "UPDATE jobs SET status = 'pending', attempts = attempts - 1, started_at = NULL WHERE id = $1 AND status = 'processing'",
            [job.id]
          );
          break;
        }

        inFlight++;
        logEvent("job_claimed", { jobId: job.id, attempts: job.attempts, inFlight });

        // Process job asynchronously without awaiting completion before claiming next
        processJob(job).catch((err) => {
          console.error("Unexpected error in processJob:", err);
        });
      } catch (err) {
        if (!isStopping) {
          console.error("Error claiming job:", err);
        }
        break;
      }
    }

    if (!isStopping) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}

/**
 * Handles graceful shutdown on SIGINT and SIGTERM signals.
 */
async function shutdown(signal: string): Promise<void> {
  if (isStopping) return;
  isStopping = true;

  logEvent("worker_stopping", { signal, inFlight });

  // Wait for all currently processing jobs to complete before closing pool
  while (inFlight > 0) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startLoop().catch((err) => {
  console.error("Fatal worker loop error:", err);
  process.exit(1);
});
