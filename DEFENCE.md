# Defence Preparation Guide

This document contains pointers to the exact file locations, line numbers, and key technical facts for defending the architecture in a live technical review.

---

## 1. Two workers are running. Walk me through exactly how you guarantee they never process the same job.

### Pointers & Code Locations

- **Primary File & Lines**: [`src/worker/claim.ts:L17-L30`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/claim.ts#L17-L30)
- **Key Technical Facts**:
  1. `FOR UPDATE` locks the candidate row in Postgres during subquery evaluation, preventing concurrent transactions from acquiring or modifying it.
  2. `SKIP LOCKED` instructs concurrent worker processes to skip already-locked rows instantly instead of blocking or waiting.
  3. The outer `UPDATE` statement flips `status = 'processing'` and increments `attempts = attempts + 1` in the exact same atomic SQL statement, guaranteeing single-worker execution.

### My answer, in my own words



---

## 2. Your worker crashed after sending the email but before marking the job done. What happens when it restarts?

### Pointers & Code Locations

- **Primary Files & Lines**:
  - Already-sent check: [`src/worker/handlers/sendTicketConfirmation.ts:L22-L25`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/handlers/sendTicketConfirmation.ts#L22-L25)
  - Resend idempotency key: [`src/worker/email.ts:L46-L55`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/email.ts#L46-L55)
  - Delivery table constraint: [`migrations/001_create_jobs.sql:L43-L44`](file:///Users/mac/Desktop/Jobs%20Project/migrations/001_create_jobs.sql#L43-L44)
- **Key Technical Facts**:
  1. **Layer 1 (Resend SDK)**: Passes `job.id` as Resend's `idempotencyKey`, so Resend returns the existing provider message ID if invoked again within 24 hours.
  2. **Layer 2 (Database Delivery Check)**: Handler queries `SELECT 1 FROM email_deliveries WHERE job_id = $1` before sending; if a delivery row exists, it logs `job_skipped_already_sent` and marks the job `succeeded` without re-sending.
  3. **Database Unique Constraint**: `CONSTRAINT email_deliveries_job_unique UNIQUE (job_id)` enforces that only one delivery record can ever be saved per job.

### My answer, in my own words



---

## 3. Why jitter? Show me the line.

### Pointers & Code Locations

- **Primary File & Line**: [`src/worker/backoff.ts:L13`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/backoff.ts#L13)
- **Key Technical Facts**:
  1. Pure exponential backoff causes the "thundering herd" problem, where a batch of jobs failing simultaneously retries at the exact same instant.
  2. Line 13 adds random jitter (`const jitter = Math.floor(Math.random() * backoffJitterMs);`) to desynchronize retries across time.
  3. The formula is `baseDelay * 2^attempts + randomJitter`.

### My answer, in my own words



---

## 4. A job has been in processing for an hour. What does your system do about it and when?

### Pointers & Code Locations

- **Primary Files & Lines**:
  - Recovery sweep query: [`src/worker/sweep.ts:L22-L31`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/sweep.ts#L22-L31)
  - Sweep timer loop: [`src/worker/worker.ts:L78-L82`](file:///Users/mac/Desktop/Jobs%20Project/src/worker/worker.ts#L78-L82)
- **Key Technical Facts**:
  1. Every worker process runs a periodic background timer every `config.sweepIntervalMs` (default 30 seconds).
  2. The sweep executes an atomic SQL update scanning for rows where `status = 'processing'` and `started_at < now() - (stuckTimeoutMs * interval '1 millisecond')`.
  3. Because 1 hour exceeds `stuckTimeoutMs` (default 5 minutes), the sweep resets the job's status to `failed` (or `dead` if max attempts reached) and sets `run_at = now()`, enabling workers to re-claim it.

### My answer, in my own words


