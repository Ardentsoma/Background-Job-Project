// src/api/routes/jobs.ts
// Express route handlers for job enqueue and job status endpoints.

import { Router, Request, Response } from "express";
import { enqueueJobSchema, uuidSchema } from "../schemas";
import { createOrGetJob, findJobById } from "../../jobs/repository";
import { Job } from "../../types";

export const jobsRouter = Router();

/** Helper for deep equality check between two JSON-serializable payloads */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !isDeepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Formats a Job row for the enqueue response envelope */
function formatEnqueueJobResponse(job: Job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    lastError: job.last_error,
    runAt: job.run_at,
    createdAt: job.created_at,
  };
}

/** Formats a Job row for the status response envelope (excludes payload) */
function formatStatusJobResponse(job: Job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    lastError: job.last_error,
    runAt: job.run_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    createdAt: job.created_at,
  };
}

// ── Endpoint 1: Enqueue Job ──────────────────────────────────────────

jobsRouter.post("/", async (req: Request, res: Response) => {
  const idempotencyKey = req.header("Idempotency-Key");

  if (!idempotencyKey || idempotencyKey.trim().length === 0 || idempotencyKey.length > 200) {
    res.status(400).json({
      error: {
        code: "MISSING_IDEMPOTENCY_KEY",
        message: "Idempotency-Key header is required and must be between 1 and 200 characters",
      },
    });
    return;
  }

  const parseResult = enqueueJobSchema.safeParse(req.body);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const pathStr = issue.path.join(".");
    const message = pathStr ? `${pathStr} ${issue.message}` : issue.message;

    res.status(422).json({
      error: {
        code: "UNPROCESSABLE_ENTITY",
        message,
      },
    });
    return;
  }

  const { type, payload } = parseResult.data;
  const { job, duplicate } = await createOrGetJob(type, payload, idempotencyKey);

  if (duplicate) {
    const payloadsMatch = isDeepEqual(job.payload, payload);

    if (!payloadsMatch) {
      res.status(409).json({
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "This key was already used with a different payload",
        },
      });
      return;
    }

    res.status(200).json({
      data: formatEnqueueJobResponse(job),
      meta: { duplicate: true },
    });
    return;
  }

  res.status(202).json({
    data: formatEnqueueJobResponse(job),
    meta: { duplicate: false },
  });
});

// ── Endpoint 2: Job Status ───────────────────────────────────────────

jobsRouter.get("/:id", async (req: Request, res: Response) => {
  const idParse = uuidSchema.safeParse(req.params.id);

  if (!idParse.success) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Job not found",
      },
    });
    return;
  }

  const job = await findJobById(idParse.data);

  if (!job) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Job not found",
      },
    });
    return;
  }

  res.status(200).json({
    data: formatStatusJobResponse(job),
  });
});
