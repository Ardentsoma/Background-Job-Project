// scripts/break-it/check_claims.ts
// CLI tool to verify job claim isolation across workers.
// Detects if any (jobId, attempts) pair was claimed more than once and checks DB email delivery counts.

import fs from "fs";
import path from "path";
import { pool } from "../../src/db";

interface LogEntry {
  ts: string;
  workerId: string;
  event: string;
  jobId?: string;
  attempts?: number;
  [key: string]: unknown;
}

function getLogFiles(customFiles: string[]): string[] {
  if (customFiles.length > 0) return customFiles;

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) return [];

  return fs
    .readdirSync(logsDir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => path.join(logsDir, f));
}

async function main() {
  const args = process.argv.slice(2);
  const logFiles = getLogFiles(args);

  if (logFiles.length === 0) {
    console.error("No log files found to inspect.");
    process.exit(1);
  }

  const claimEntries: LogEntry[] = [];

  for (const file of logFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as LogEntry;
        if (parsed.event === "job_claimed" && parsed.jobId && parsed.attempts !== undefined) {
          claimEntries.push(parsed);
        }
      } catch {
        // Silently skip non-JSON log lines
        continue;
      }
    }
  }

  const claimsPerWorker: Record<string, number> = {};
  const distinctJobs = new Set<string>();
  const claimPairCounts: Record<string, number> = {};
  let duplicateClaimsFound = false;

  for (const c of claimEntries) {
    const wId = c.workerId || "unknown";
    claimsPerWorker[wId] = (claimsPerWorker[wId] || 0) + 1;
    if (c.jobId) distinctJobs.add(c.jobId);

    const pairKey = `${c.jobId}:${c.attempts}`;
    claimPairCounts[pairKey] = (claimPairCounts[pairKey] || 0) + 1;
    if (claimPairCounts[pairKey] > 1) {
      duplicateClaimsFound = true;
    }
  }

  console.log("=== Job Claim Audit ===");
  console.log(`Total Job Claim Events: ${claimEntries.length}`);
  console.log(`Distinct Jobs Claimed: ${distinctJobs.size}`);
  console.log("Claims Per Worker:", claimsPerWorker);

  // Database checks
  let deliveryCount = 0;
  let maxAttemptsSucceeded = 0;

  try {
    const delRes = await pool.query<{ count: string }>("SELECT count(*) FROM email_deliveries;");
    deliveryCount = parseInt(delRes.rows[0].count, 10);

    const succRes = await pool.query<{ max: number | null }>(
      "SELECT max(attempts) FROM jobs WHERE status = 'succeeded';"
    );
    maxAttemptsSucceeded = succRes.rows[0].max ?? 0;
  } catch (err) {
    console.error("Database query warning:", err);
  } finally {
    await pool.end();
  }

  console.log(`DB email_deliveries count: ${deliveryCount}`);
  console.log(`DB Max attempts among succeeded jobs: ${maxAttemptsSucceeded}`);

  if (duplicateClaimsFound) {
    console.log("FAIL: Duplicate claim detected for the same (jobId, attempts) pair!");
    const duplicates = Object.entries(claimPairCounts).filter(([, count]) => count > 1);
    console.log("Duplicate Pair Keys:", duplicates);
  } else {
    console.log("PASS: No duplicate claims detected across workers.");
  }
}

main().catch((err) => {
  console.error("Check claims error:", err);
  process.exit(1);
});
