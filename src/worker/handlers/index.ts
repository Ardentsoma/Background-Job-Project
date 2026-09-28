// src/worker/handlers/index.ts
// Handler registry mapping job types to their processing functions.

import { Job } from "../../types";
import { handleSendTicketConfirmation } from "./sendTicketConfirmation";

export type JobHandler = (job: Job) => Promise<void>;

export const handlers: Record<string, JobHandler> = {
  send_ticket_confirmation: handleSendTicketConfirmation,
};
