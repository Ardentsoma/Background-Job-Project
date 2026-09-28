# Break-It Verification Test Runbook

This document details the exact commands, goals, expected outcomes, and evidence locations for running the project's break-it test suite.

---

## 1. 50 Jobs and the Concurrency Cap

**Goal:** Prove that the worker processes a batch of 50 jobs concurrently without exceeding the configured concurrency limit.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. In another terminal, start worker with concurrency cap = 3 (redirect logs to logs/concurrency.log)
EMAIL_MODE=dry CONCURRENCY=3 npm run dev:worker > logs/concurrency.log 2>&1

# 3. Enqueue 50 jobs via HTTP API
npm run enqueue:many -- 50

# 4. Wait for processing to complete, then inspect snapshot and verify concurrency cap
npm run snapshot
npm run check:concurrency -- logs/concurrency.log --cap 3
```

**Expected Result:**
All 50 jobs reach `succeeded` status. `npm run check:concurrency` prints `PASS` confirming maximum observed in-flight jobs per worker did not exceed 3.

**Result:**
TO FILL

---

## 2. 100 Percent Failure to Dead with Backoff

**Goal:** Prove that a job experiencing repeated failures retries with exponential backoff delay until reaching max attempts, where it transitions to dead status.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. Start worker with 100% failure simulation and small backoff (redirect logs to logs/backoff.log)
EMAIL_MODE=dry SIMULATE_FAILURE_RATE=1 BACKOFF_BASE_MS=200 BACKOFF_JITTER_MS=100 POLL_INTERVAL_MS=200 npm run dev:worker > logs/backoff.log 2>&1

# 3. Enqueue 1 job
npm run enqueue:many -- 1

# 4. Inspect status snapshot and attempt backoff timeline (replace <jobId> with enqueued job ID)
npm run snapshot
npm run attempts -- <jobId> logs/backoff.log
```

**Expected Result:**
Job transitions through `failed` status 4 times with growing time gaps before ending in `dead` status with 5 attempts. `npm run attempts` table shows exponential delay growth.

**Result:**
TO FILL

---

## 3. Kill Mid-Job and Recovery

**Goal:** Prove that if a worker process crashes while processing a job, the background sweep detects the stuck job and recovers it safely.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. Start worker with artificial delay (5 seconds)
EMAIL_MODE=dry SIMULATE_DELAY_MS=5000 npm run dev:worker > logs/kill_recovery.log 2>&1

# 3. Enqueue 1 job
npm run enqueue:many -- 1

# 4. Wait 1 second (so worker claims and enters processing), then forcefully kill the worker process (SIGKILL / kill -9)

# 5. Start a new worker with short stuck timeout and sweep interval to recover the job
EMAIL_MODE=dry STUCK_TIMEOUT_MS=3000 SWEEP_INTERVAL_MS=1000 npm run dev:worker >> logs/kill_recovery.log 2>&1

# 6. Verify job recovery to succeeded
npm run snapshot
```

**Expected Result:**
The stuck job left in `processing` by the killed worker is recovered by the sweep, reset to `failed`, re-claimed, and successfully processed to `succeeded`.

**Result:**
TO FILL

---

## 4. Same Idempotency Key Twice

**Goal:** Prove that submitting the exact same request twice creates only one job row and returns identical data.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. Send first enqueue request
curl -i -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ticket-confirmation/DUP-KEY-001" \
  -d '{"type":"send_ticket_confirmation","payload":{"to":"delivered@resend.dev","recipientName":"Alice","eventTitle":"Fest","ticketId":"DUP-KEY-001"}}'

# 3. Send second identical enqueue request
curl -i -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ticket-confirmation/DUP-KEY-001" \
  -d '{"type":"send_ticket_confirmation","payload":{"to":"delivered@resend.dev","recipientName":"Alice","eventTitle":"Fest","ticketId":"DUP-KEY-001"}}'

# 4. Verify database count for key
npx tsx -e 'import { pool } from "./src/db"; pool.query("SELECT count(*) FROM jobs WHERE idempotency_key = '\''ticket-confirmation/DUP-KEY-001'\'';").then(r => { console.log("DB Key Count:", r.rows[0].count); pool.end(); });'
```

**Expected Result:**
First request returns HTTP 202 with `meta.duplicate: false`. Second request returns HTTP 200 with identical job ID and `meta.duplicate: true`. SQL count returns 1.

**Result:**
TO FILL

---

## 5. Two Workers at Once

**Goal:** Prove that two concurrent worker processes running simultaneously lock jobs cleanly using `FOR UPDATE SKIP LOCKED` without claiming the same job twice.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. Start Worker 1 (redirect logs to logs/worker1.log)
EMAIL_MODE=dry WORKER_ID=worker-alpha npm run dev:worker > logs/worker1.log 2>&1 &

# 3. Start Worker 2 (redirect logs to logs/worker2.log)
EMAIL_MODE=dry WORKER_ID=worker-beta npm run dev:worker > logs/worker2.log 2>&1 &

# 4. Enqueue 30 jobs
npm run enqueue:many -- 30

# 5. Audit job claim uniqueness across worker logs and DB delivery counts
npm run check:claims -- logs/worker1.log logs/worker2.log
```

**Expected Result:**
Both workers process jobs concurrently. `npm run check:claims` reports `PASS: No duplicate claims detected across workers` and DB `email_deliveries` count equals 30.

**Result:**
TO FILL

---

## 6. Double Run Produces One Output

**Goal:** Prove that even if a job execution is re-triggered, only a single email delivery row and provider message ID are recorded in `email_deliveries`.

**Commands to run:**
```bash
# Inspect job delivery record (replace <jobId> with target job ID)
npm run recheck:double-run -- <jobId>
```

**Expected Result:**
Prints job details and confirms `Email Deliveries Row Count: 1` with a single `provider_message_id`, outputting `VERDICT: One delivery, one provider message ID.`

**Result:**
TO FILL

---

## 7. Crash After Send

**Goal:** Prove that if a worker crashes immediately after Resend accepts the email but before writing to `email_deliveries`, the second worker attempt skips re-sending email upon recovery.

**Commands to run:**
```bash
# 1. Start API server
npm run dev:api

# 2. Start worker configured to crash immediately after send step on attempt 1
EMAIL_MODE=dry SIMULATE_CRASH_AFTER_SEND=true npm run dev:worker > logs/crash_after_send.log 2>&1

# 3. Enqueue 1 job
npm run enqueue:many -- 1

# (Worker process exits with code 1 after sending)

# 4. Start normal worker to process attempt 2
EMAIL_MODE=dry npm run dev:worker >> logs/crash_after_send.log 2>&1

# 5. Check double run result for job (replace <jobId> with enqueued job ID)
npm run recheck:double-run -- <jobId>
```

**Expected Result:**
Attempt 2 detects existing `email_deliveries` row (or skips duplicate API send), logs `job_skipped_already_sent`, marks job `succeeded`, and maintains exactly 1 delivery record.

**Result:**
TO FILL
