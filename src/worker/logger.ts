// src/worker/logger.ts
// JSON line logger for worker events.
// Outputs structured JSON log lines to stdout with timestamps and worker identification.

import { workerId } from "../config";

export interface LogFields {
  [key: string]: unknown;
}

/**
 * Emits a single line of structured JSON log output to stdout.
 */
export function logEvent(event: string, fields: LogFields = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    workerId,
    event,
    ...fields,
  };
  console.log(JSON.stringify(entry));
}
