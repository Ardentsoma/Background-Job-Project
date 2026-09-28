// src/worker/handlers/sendTicketConfirmation.ts
// Handler for send_ticket_confirmation job type.
// Performs already-sent check, sends email via Resend, records delivery, and updates job status.

import { pool } from "../../db";
import { Job } from "../../types";
import { logEvent } from "../logger";
import { sendEmail, SendEmailPayload } from "../email";
import { markSucceeded } from "../complete";
import {
  simulateDelayMs,
  simulateFailureRate,
  simulateCrashAfterSend,
} from "../../config";

/**
 * Processes a single send_ticket_confirmation job step by step.
 */
export async function handleSendTicketConfirmation(job: Job): Promise<void> {
  // Step 1: Check email_deliveries for this job id to prevent duplicate sends.
  const deliveryCheck = await pool.query(
    "SELECT 1 FROM email_deliveries WHERE job_id = $1 LIMIT 1;",
    [job.id]
  );

  if (deliveryCheck.rows.length > 0) {
    logEvent("job_skipped_already_sent", { jobId: job.id });
    await markSucceeded(job.id, job.attempts);
    return;
  }

  // Step 2: If simulateDelayMs is set, wait before continuing.
  if (simulateDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulateDelayMs));
  }

  // Step 3: If simulateFailureRate is set, throw a simulated failure based on random draw.
  if (simulateFailureRate > 0 && Math.random() < simulateFailureRate) {
    throw new Error("Simulated failure");
  }

  // Step 4: Build and send the email using only the stored payload.
  const payload = job.payload as unknown as SendEmailPayload;
  const { providerMessageId } = await sendEmail(job.id, payload);

  // Step 5: If simulateCrashAfterSend is true and this is attempt 1, exit process immediately.
  if (simulateCrashAfterSend && job.attempts === 1) {
    console.error("FATAL: Simulating crash immediately after send");
    process.exit(1);
  }

  // Step 6: Record delivery row in email_deliveries with ON CONFLICT DO NOTHING.
  const insertDeliveryQuery = `
    INSERT INTO email_deliveries (job_id, recipient, provider_message_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (job_id) DO NOTHING;
  `;
  await pool.query(insertDeliveryQuery, [job.id, payload.to, providerMessageId]);

  // Step 7: Mark the job as succeeded.
  await markSucceeded(job.id, job.attempts);
}
