// src/api/server.ts
// Express API entry point.
// Mounts routes for health checks and job management.

import express, { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { port } from "../config";
import { jobsRouter } from "./routes/jobs";

const app = express();

app.use(express.json());

// Handle malformed JSON body errors from express.json() parser
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON body",
      },
    });
    return;
  }
  next(err);
});

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

/** Mount job management endpoints */
app.use("/api/jobs", jobsRouter);

// ── Error handling middleware ────────────────────────────────────────

/** Catches any unhandled error and returns the standard error envelope. Never leaks stack traces. */
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
