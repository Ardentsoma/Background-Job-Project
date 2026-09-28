// scripts/break-it/recheck_double_run.ts
// CLI tool for the double-run proof.
// Prints job row, email_deliveries rows count, and provider_message_id to confirm one delivery per job.

import { pool } from "../../src/db";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npm run recheck:double-run -- <jobId>");
    process.exit(1);
  }

  const jobId = args[0];

  try {
    const jobRes = await pool.query<{
      id: string;
      type: string;
      status: string;
      attempts: number;
      idempotency_key: string;
    }>("SELECT id, type, status, attempts, idempotency_key FROM jobs WHERE id = $1;", [jobId]);

    if (jobRes.rows.length === 0) {
      console.error(`Job ID not found in database: ${jobId}`);
      process.exit(1);
    }

    const job = jobRes.rows[0];

    const delRes = await pool.query<{
      id: string;
      recipient: string;
      provider_message_id: string;
      sent_at: Date;
    }>("SELECT id, recipient, provider_message_id, sent_at FROM email_deliveries WHERE job_id = $1;", [jobId]);

    console.log("=== Double Run Re-check Summary ===");
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status} (Attempts: ${job.attempts})`);
    console.log(`Idempotency Key: ${job.idempotency_key}`);
    console.log(`Email Deliveries Row Count: ${delRes.rows.length}`);

    if (delRes.rows.length > 0) {
      const del = delRes.rows[0];
      console.log(`Recipient: ${del.recipient}`);
      console.log(`Provider Message ID: ${del.provider_message_id}`);
      console.log(`Sent At: ${new Date(del.sent_at).toISOString()}`);
    } else {
      console.log("Provider Message ID: N/A (No delivery row found)");
    }

    console.log("");
    if (delRes.rows.length === 1) {
      console.log("VERDICT: One delivery, one provider message ID.");
    } else if (delRes.rows.length === 0) {
      console.log("VERDICT: Zero deliveries recorded.");
    } else {
      console.log(`VERDICT: MULTIPLE DELIVERIES DETECTED (${delRes.rows.length})!`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Double-run re-check error:", err);
  process.exit(1);
});
