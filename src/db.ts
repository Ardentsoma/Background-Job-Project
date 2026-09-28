// src/db.ts
// Creates and exports a single pg Pool connected to Neon.
// Every module that needs the database imports this pool.

import { Pool } from "pg";
import { env } from "./config";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Neon requires SSL for all connections
  ssl: { rejectUnauthorized: false },
});
