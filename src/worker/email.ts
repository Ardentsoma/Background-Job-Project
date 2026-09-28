// src/worker/email.ts
// Email generation and sending wrapper around the official Resend SDK.

import { Resend } from "resend";
import { env, emailMode } from "../config";

const resend = new Resend(env.RESEND_API_KEY);

/** Escapes special HTML characters to prevent HTML injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface SendEmailPayload {
  to: string;
  recipientName: string;
  eventTitle: string;
  ticketId: string;
}

export interface SendEmailResult {
  providerMessageId: string;
}

/**
 * Sends a ticket confirmation email using Resend (or dry-mode simulation).
 * Passes job.id as Resend idempotency key.
 */
export async function sendEmail(
  jobId: string,
  payload: SendEmailPayload
): Promise<SendEmailResult> {
  if (emailMode === "dry") {
    return { providerMessageId: `dry-${jobId}` };
  }

  const subject = `Your ticket for ${payload.eventTitle}`;
  const text = `Hi ${payload.recipientName},\n\nHere is your ticket for ${payload.eventTitle}.\nTicket ID: ${payload.ticketId}\n\nThank you!`;
  
  const safeName = escapeHtml(payload.recipientName);
  const safeTitle = escapeHtml(payload.eventTitle);
  const safeTicket = escapeHtml(payload.ticketId);

  const html = `<p>Hi ${safeName},</p><p>Here is your ticket for <strong>${safeTitle}</strong>.</p><p>Ticket ID: <code>${safeTicket}</code></p><p>Thank you!</p>`;

  // Call Resend SDK passing job.id as idempotency key
  const { data, error } = await resend.emails.send(
    {
      from: env.EMAIL_FROM,
      to: payload.to,
      subject,
      text,
      html,
    },
    {
      idempotencyKey: jobId,
    }
  );

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  if (!data || !data.id) {
    throw new Error("Resend API returned success but missing message ID");
  }

  return { providerMessageId: data.id };
}
