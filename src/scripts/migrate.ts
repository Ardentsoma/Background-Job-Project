// src/scripts/migrate.ts
// Migration runner.
// Reads .sql files from /migrations in filename order, tracks which have run
// in a schema_migrations table, and runs only the new ones inside transactions.
// Running this script twice changes nothing.

import fs from "fs";
import path from "path";
import { pool } from "../db";

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // Ensure the tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Read all .sql files from the migrations directory, sorted by name
    const migrationsDir = path.join(__dirname, "..", "..", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // Find out which migrations have already been applied
    const result = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(result.rows.map((r: { filename: string }) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`APPLY ${file}`);

      // Run the migration and record it, all inside one transaction
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
