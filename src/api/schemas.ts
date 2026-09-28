// src/api/schemas.ts
// Zod schemas for request validation.
// Imported by route handlers to validate input before touching the database.

import { z } from "zod";

/** Body schema for POST /api/jobs */
export const enqueueJobSchema = z
  .object({
    type: z.literal("send_ticket_confirmation"),
    payload: z
      .object({
        to: z.string().email("must be a valid email"),
        recipientName: z.string().min(1).max(100),
        eventTitle: z.string().min(1).max(200),
        ticketId: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict();

/** Validates that a string is a UUID */
export const uuidSchema = z.string().uuid();
