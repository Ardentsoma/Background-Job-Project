// scripts/break-it/snapshot.ts
// CLI tool to print a summary snapshot of job counts per status and a table of the latest 25 jobs.

import { pool } from "../../src/db";

function formatTime(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toISOString().slice(11, 19); // HH:MM:SS
}

async function main() {
  try {
    // 1. Status count summary
    const countRes = await pool.query<{ status: string; count: string }>(`
      SELECT status, count(*) FROM jobs GROUP BY status;
    `);

    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      dead: 0,
    };

    for (const row of countRes.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }

    console.log("=== Job Status Counts ===");
    console.log(
      `Pending: ${counts.pending} | Processing: ${counts.processing} | Succeeded: ${counts.succeeded} | Failed: ${counts.failed} | Dead: ${counts.dead}`
    );
    console.log("");

    // 2. Latest 25 jobs table
    const jobsRes = await pool.query<{
      id: string;
      status: string;
      attempts: number;
      max_attempts: number;
      run_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_error: string | null;
    }>(`
      SELECT id, status, attempts, max_attempts, run_at, started_at, finished_at, last_error
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 25;
    `);

    console.log("=== Latest 25 Jobs ===");
    const tableData = jobsRes.rows.map((r) => ({
      shortId: r.id.slice(0, 8),
      status: r.status,
      attempts: `${r.attempts}/${r.max_attempts}`,
      runAt: formatTime(r.run_at),
      startedAt: formatTime(r.started_at),
      finishedAt: formatTime(r.finished_at),
      lastError: r.last_error ? r.last_error.slice(0, 40) : "-",
    }));

    console.table(tableData);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Snapshot error:", err);
  process.exit(1);
});
