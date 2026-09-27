import type { JobPayload } from "./job.model.js";

export type EventOperation = "upsert" | "archive";

export type EventStatus = "pending" | "processing" | "completed" | "failed";

export interface EventError {
  code: string;
  message: string;
  at: Date;
}

export interface EventDocument {
  tenantId: string;
  sourceId: string;
  eventId: string;
  externalJobId: string;
  version: number;
  operation: EventOperation;
  payload?: JobPayload;
  status: EventStatus;
  attempts: number;
  nextAttemptAt: Date;
  claimedBy?: string;
  leaseUntil?: Date;
  lastError?: EventError;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}