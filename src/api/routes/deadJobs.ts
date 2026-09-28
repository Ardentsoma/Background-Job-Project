// src/api/routes/deadJobs.ts
// Express route handlers for dead letter queue endpoints: GET /api/dead-jobs and POST /api/dead-jobs/:id/retry.

import { Router, Request, Response } from "express";
import { uuidSchema } from "../schemas";
import { getDeadJobs, retryDeadJob } from "../../jobs/repository";
import { Job } from "../../types";

export const deadJobsRouter = Router();

/** Formats a dead job item for GET /api/dead-jobs response */
function formatDeadJobItem(job: Job) {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    lastError: job.last_error,
    createdAt: job.created_at,
    finishedAt: job.finished_at,
  };
}

/** Formats a job row for POST /api/dead-jobs/:id/retry response */
function formatRetryJobResponse(job: Job) {
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

// ── GET /api/dead-jobs ──────────────────────────────────────────────

deadJobsRouter.get("/", async (_req: Request, res: Response) => {
  const jobs = await getDeadJobs(50);
  res.status(200).json({
    data: jobs.map(formatDeadJobItem),
  });
});

// ── POST /api/dead-jobs/:id/retry ───────────────────────────────────

deadJobsRouter.post("/:id/retry", async (req: Request, res: Response) => {
  const parseResult = uuidSchema.safeParse(req.params.id);

  if (!parseResult.success) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Job not found",
      },
    });
    return;
  }

  const result = await retryDeadJob(parseResult.data);

  if (result.status === "not_found") {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Job not found",
      },
    });
    return;
  }

  if (result.status === "not_dead") {
    res.status(409).json({
      error: {
        code: "NOT_DEAD",
        message: "Job is not in dead state",
      },
    });
    return;
  }

  res.status(200).json({
    data: formatRetryJobResponse(result.job),
  });
});
