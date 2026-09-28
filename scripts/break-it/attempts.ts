// scripts/break-it/attempts.ts
// CLI tool to inspect backoff timeline for a specific job across worker log files.
// Prints a table showing event, timestamp, attempts, delayMs, nextRunAt, and gap in seconds since previous event.

import fs from "fs";
import path from "path";

interface LogEntry {
  ts: string;
  workerId: string;
  event: string;
  jobId?: string;
  attempts?: number;
  delayMs?: number;
  nextRunAt?: string;
  error?: string;
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

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npm run attempts -- <jobId> [logfile...]");
    process.exit(1);
  }

  const targetJobId = args[0];
  const customLogs = args.slice(1);
  const logFiles = getLogFiles(customLogs);

  if (logFiles.length === 0) {
    console.error("No log files found to inspect.");
    process.exit(1);
  }

  const matchingEntries: LogEntry[] = [];

  for (const file of logFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as LogEntry;
        if (parsed.jobId === targetJobId || (parsed.jobId && parsed.jobId.startsWith(targetJobId))) {
          matchingEntries.push(parsed);
        }
      } catch {
        // Silently skip non-JSON log lines
        continue;
      }
    }
  }

  matchingEntries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (matchingEntries.length === 0) {
    console.log(`No log events found for job ID: ${targetJobId}`);
    return;
  }

  console.log(`=== Backoff Timeline for Job: ${targetJobId} ===`);

  let lastTs: number | null = null;
  const tableData = matchingEntries.map((e) => {
    const currentTs = new Date(e.ts).getTime();
    const gapSec = lastTs !== null ? ((currentTs - lastTs) / 1000).toFixed(2) : "-";
    lastTs = currentTs;

    return {
      event: e.event,
      timestamp: new Date(e.ts).toISOString().slice(11, 23),
      attempts: e.attempts ?? "-",
      delayMs: e.delayMs ?? "-",
      nextRunAt: e.nextRunAt ? new Date(e.nextRunAt).toISOString().slice(11, 19) : "-",
      gapSec,
    };
  });

  console.table(tableData);
}

main();
