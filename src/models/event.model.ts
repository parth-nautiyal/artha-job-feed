import { EVENT_OPERATION, EVENT_STATUS } from "./constants.js";
import type { JobPayload } from "./job.model.js";

export type EventOperation =
  | typeof EVENT_OPERATION.UPSERT
  | typeof EVENT_OPERATION.ARCHIVE;

export type EventStatus =
  | typeof EVENT_STATUS.PENDING
  | typeof EVENT_STATUS.PROCESSING
  | typeof EVENT_STATUS.SUCCEEDED
  | typeof EVENT_STATUS.FAILED;

export interface NormalizedEvent {
  tenantId: string;
  sourceId: string;
  eventId: string;
  externalJobId: string;
  version: number;
  operation: EventOperation;
  payload?: JobPayload;
}

export interface EventDocument extends NormalizedEvent {
  status: EventStatus;
  attempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
