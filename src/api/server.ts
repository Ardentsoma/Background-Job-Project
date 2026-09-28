// src/api/server.ts
// Express API entry point.
// Starts the HTTP server with a health check route and error-handling middleware.

import express, { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { port } from "../config";

const app = express();

app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────

/** Health check — confirms the API can reach the database */
app.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query("SELECT 1");
    res.json({ data: { status: "ok" } });
  } catch (err) {
    next(err);
  }
});

// ── Error handling middleware ────────────────────────────────────────

/** Catches any error and returns the standard error envelope. Never leaks stack traces. */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again later.",
    },
  });
});

// ── Start ───────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
