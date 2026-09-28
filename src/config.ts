// src/config.ts
// Every tunable number for the job system lives here.
// Handler and worker files import from this module instead of hardcoding values.

import dotenv from "dotenv";
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

// ── Tunable numbers ─────────────────────────────────────────────────

/** How many times a job may be attempted before it becomes dead */
export const maxAttempts = 5;

/** Base delay in ms before retrying a failed job (used with exponential backoff) */
export const backoffBaseMs = 1_000;

/** Random jitter added to backoff to prevent thundering herd (ms) */
export const backoffJitterMs = 500;

/** Maximum number of jobs the worker processes at the same time */
export const concurrency = 3;

/** How often the worker polls for new jobs (ms) */
export const pollIntervalMs = 1_000;

/** A processing job older than this is considered stuck and can be reclaimed (ms) */
export const stuckTimeoutMs = 300_000;

/** Port the Express API listens on */
export const port = parseInt(process.env.PORT || "3000", 10);
