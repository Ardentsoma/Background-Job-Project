// src/worker/worker.ts
// Worker process entry point.
// For now it prints a startup line and exits cleanly on SIGINT.
// The polling loop and job processing will be added later.

import "../config"; // load env vars and validate them
import { pool } from "../db";

console.log("Worker started. Waiting for jobs... (no loop yet)");

// Graceful shutdown on Ctrl+C
process.on("SIGINT", async () => {
  console.log("\nSIGINT received. Shutting down worker...");
  await pool.end();
  console.log("Database pool closed. Goodbye.");
  process.exit(0);
});
