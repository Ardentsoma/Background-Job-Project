// src/config.ts
// Every tunable number and environment configuration for the job system lives here.
// Handler and worker files import from this module instead of hardcoding values.

import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

// ── Environment variables ───────────────────────────────────────────

/** Neon Postgres connection string */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set. Add it to your .env file.");
  process.exit(1);
}

/** Resend API key */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("FATAL: RESEND_API_KEY is not set. Add it to your .env file.");
  process.exit(1);
}

/** Verified sender email address */
const EMAIL_FROM = process.env.EMAIL_FROM;
if (!EMAIL_FROM) {
  console.error("FATAL: EMAIL_FROM is not set. Add it to your .env file.");
  process.exit(1);
}

export const env = {
  DATABASE_URL,
  RESEND_API_KEY,
  EMAIL_FROM,
} as const;

// ── Tunable numbers & worker options (overridable via env vars) ──────

/** How many times a job may be attempted before it becomes dead */
export const maxAttempts = parseInt(process.env.MAX_ATTEMPTS || "5", 10);

/** Base delay in ms before retrying a failed job (used with exponential backoff) */
export const backoffBaseMs = parseInt(process.env.BACKOFF_BASE_MS || "1000", 10);

/** Random jitter added to backoff to prevent thundering herd (ms) */
export const backoffJitterMs = parseInt(process.env.BACKOFF_JITTER_MS || "500", 10);

/** Maximum number of jobs the worker runs at the same time */
export const concurrency = parseInt(process.env.CONCURRENCY || "3", 10);

/** How often the worker polls for new jobs (ms) */
export const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);

/** A processing job older than this is considered stuck and can be reclaimed (ms) */
export const stuckTimeoutMs = parseInt(process.env.STUCK_TIMEOUT_MS || "300000", 10);

/** How often the worker sweeps for stuck processing jobs (ms) */
export const sweepIntervalMs = parseInt(process.env.SWEEP_INTERVAL_MS || "30000", 10);

/** Port the Express API listens on */
export const port = parseInt(process.env.PORT || "3000", 10);

/** Unique identifier for this worker instance */
export const workerId = process.env.WORKER_ID || `worker-${crypto.randomBytes(3).toString("hex")}`;

// ── Test-only knobs (for break-it tests only) ─────────────────────────

/** Mode for sending emails: 'live' calls Resend API, 'dry' skips Resend and returns fake id */
export const emailMode = (process.env.EMAIL_MODE || "live") as "live" | "dry";

/** Probability (0 to 1) that the send step throws a simulated failure before sending */
export const simulateFailureRate = parseFloat(process.env.SIMULATE_FAILURE_RATE || "0");

/** Extra wait inside the handler before sending to simulate slow jobs (ms) */
export const simulateDelayMs = parseInt(process.env.SIMULATE_DELAY_MS || "0", 10);

/** When true, worker process exits immediately after Resend accepts email on attempt 1 */
export const simulateCrashAfterSend = process.env.SIMULATE_CRASH_AFTER_SEND === "true";
