// src/worker/backoff.ts
// Pure function to calculate exponential backoff delay with random jitter.

import { backoffBaseMs, backoffJitterMs } from "../config";

/**
 * Calculates exponential backoff delay in milliseconds for a given attempt count.
 * Includes random jitter to prevent thundering herd scenarios.
 */
export function computeBackoffMs(attempts: number): number {
  const base = backoffBaseMs * 2 ** attempts;
  // Jitter prevents the thundering herd problem: without it, multiple jobs that failed at the same time will retry at the exact same instant and hammer the same broken service.
  const jitter = Math.floor(Math.random() * backoffJitterMs);
  return base + jitter;
}
