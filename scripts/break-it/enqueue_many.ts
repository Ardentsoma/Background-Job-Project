// scripts/break-it/enqueue_many.ts
// CLI tool to enqueue multiple jobs over HTTP to the running API.
// Generates unique idempotency keys per job and summarizes status codes received.

import crypto from "crypto";

async function main() {
  const args = process.argv.slice(2);
  let count = 0;
  let toAddress = "delivered@resend.dev";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--to" && args[i + 1]) {
      toAddress = args[i + 1];
      i++;
    } else if (!isNaN(parseInt(args[i], 10))) {
      count = parseInt(args[i], 10);
    }
  }

  if (count <= 0) {
    console.error("Usage: npm run enqueue:many -- <count> [--to <address>]");
    process.exit(1);
  }

  const runId = crypto.randomBytes(3).toString("hex");
  const statusCounts: Record<number, number> = {};

  console.log(`Sending ${count} job enqueue requests (runId: ${runId}, recipient: ${toAddress})...`);

  for (let i = 1; i <= count; i++) {
    const ticketId = `TICK-BULK-${runId}-${i}`;
    const idempotencyKey = `bulk-${runId}-${i}`;

    const payload = {
      type: "send_ticket_confirmation",
      payload: {
        to: toAddress,
        recipientName: `Bulk User ${i}`,
        eventTitle: "Bulk Load Test",
        ticketId,
      },
    };

    try {
      const res = await fetch("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    } catch (err) {
      console.error(`Request ${i} failed:`, err);
      statusCounts[0] = (statusCounts[0] || 0) + 1;
    }
  }

  console.log("--- Enqueue Summary ---");
  console.log(`Run ID: ${runId}`);
  console.log("Status Codes Received:");
  for (const [code, cnt] of Object.entries(statusCounts)) {
    console.log(`  ${code}: ${cnt}`);
  }
}

main();
