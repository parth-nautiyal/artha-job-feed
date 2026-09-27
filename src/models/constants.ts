export const EVENT_OPERATION = {
  UPSERT: "upsert",
  ARCHIVE: "archive",
} as const;

export const EVENT_OPERATIONS = [EVENT_OPERATION.UPSERT, EVENT_OPERATION.ARCHIVE] as const;

export const EVENT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

export const EVENT_STATUSES = [
  EVENT_STATUS.PENDING,
  EVENT_STATUS.PROCESSING,
  EVENT_STATUS.SUCCEEDED,
  EVENT_STATUS.FAILED,
] as const;

export const JOB_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export const JOB_STATUSES = [JOB_STATUS.ACTIVE, JOB_STATUS.ARCHIVED] as const;
