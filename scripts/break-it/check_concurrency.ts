// scripts/break-it/check_concurrency.ts
// CLI tool to verify worker concurrency cap compliance from log files.
// Rebuilds in-flight job count over time and prints PASS or FAIL.

import fs from "fs";
import path from "path";
import { concurrency as defaultCap } from "../../src/config";

interface LogEntry {
  ts: string;
  workerId: string;
  event: string;
  jobId?: string;
  inFlight?: number;
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
  let cap = defaultCap;
  const customLogs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cap" && args[i + 1]) {
      cap = parseInt(args[i + 1], 10);
      i++;
    } else {
      customLogs.push(args[i]);
    }
  }

  const logFiles = getLogFiles(customLogs);

  if (logFiles.length === 0) {
    console.error("No log files found to inspect.");
    process.exit(1);
  }

  const allEntries: LogEntry[] = [];

  for (const file of logFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as LogEntry;
        if (parsed.event && parsed.ts) {
          allEntries.push(parsed);
        }
      } catch {
        // Silently skip non-JSON log lines
        continue;
      }
    }
  }

  allEntries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // Track active in-flight jobs per worker over time
  const activeJobsPerWorker: Record<string, Set<string>> = {};
  let maxInFlightTotal = 0;
  let maxInFlightPerWorker = 0;

  const timeline: Array<{ ts: string; workerId: string; event: string; jobId: string; inFlight: number }> = [];

  for (const entry of allEntries) {
    const wId = entry.workerId || "unknown";
    if (!activeJobsPerWorker[wId]) {
      activeJobsPerWorker[wId] = new Set();
    }

    const currentWorkerSet = activeJobsPerWorker[wId];

    if (entry.event === "job_claimed" && entry.jobId) {
      currentWorkerSet.add(entry.jobId);
    } else if (
      ["job_succeeded", "job_failed", "job_dead", "job_skipped_already_sent"].includes(entry.event) &&
      entry.jobId
    ) {
      currentWorkerSet.delete(entry.jobId);
    }

    const countForWorker = currentWorkerSet.size;
    if (countForWorker > maxInFlightPerWorker) {
      maxInFlightPerWorker = countForWorker;
    }

    // Sum total across workers or use worker reported count
    let totalInFlight = 0;
    for (const s of Object.values(activeJobsPerWorker)) {
      totalInFlight += s.size;
    }

    if (totalInFlight > maxInFlightTotal) {
      maxInFlightTotal = totalInFlight;
    }

    if (["job_claimed", "job_succeeded", "job_failed", "job_dead"].includes(entry.event)) {
      timeline.push({
        ts: new Date(entry.ts).toISOString().slice(11, 23),
        workerId: wId,
        event: entry.event,
        jobId: entry.jobId ? entry.jobId.slice(0, 8) : "-",
        inFlight: countForWorker,
      });
    }
  }

  console.log(`=== Concurrency Verification (Cap: ${cap}) ===`);
  console.log(`Max In-Flight Jobs Reached Per Worker: ${maxInFlightPerWorker}`);
  console.log(`First ${Math.min(30, timeline.length)} Timeline Events:`);
  console.table(timeline.slice(0, 30));

  if (maxInFlightPerWorker <= cap) {
    console.log(`PASS: Concurrency cap of ${cap} was respected (max observed: ${maxInFlightPerWorker}).`);
  } else {
    console.log(`FAIL: Concurrency cap of ${cap} was EXCEEDED (max observed: ${maxInFlightPerWorker})!`);
  }
}

main();
