import { EVENT_OPERATION, EVENT_OPERATIONS } from "../models/constants.js";
import type { EventOperation, NormalizedEvent } from "../models/event.model.js";
import type { JobPayload } from "../models/job.model.js";

type RawEventInput = {
  tenantId?: unknown;
  sourceId?: unknown;
  eventId?: unknown;
  externalJobId?: unknown;
  version?: unknown;
  operation?: unknown;
  payload?: unknown;
};

function isRecord(value: unknown): value is RawEventInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNoSurroundingWhitespace(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string" || !hasNoSurroundingWhitespace(value)) {
    return undefined;
  }

  return value;
}

function normalizeOperation(value: unknown): EventOperation | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value) {
    case EVENT_OPERATION.UPSERT:
    case EVENT_OPERATION.ARCHIVE:
      return value;
    default:
      return undefined;
  }
}

function normalizeVersion(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return undefined;
  }

  return value;
}

function normalizeDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

function normalizeExperience(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 50) {
    return undefined;
  }

  return value;
}

function normalizeApplyUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(trimmed);
    return parsedUrl.protocol === "https:" ? parsedUrl.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedSkills: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      return undefined;
    }

    const normalizedSkill = item.trim().toLowerCase();
    if (normalizedSkill.length === 0) {
      return undefined;
    }

    if (seen.has(normalizedSkill)) {
      continue;
    }

    seen.add(normalizedSkill);
    normalizedSkills.push(normalizedSkill);
  }

  return normalizedSkills;
}

function normalizeJobPayload(value: unknown): JobPayload | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = [
    "title",
    "company",
    "location",
    "experienceMin",
    "experienceMax",
    "applyUrl",
    "skills",
  ];

  if (Object.keys(record).length !== allowedKeys.length) {
    return undefined;
  }

  const unexpectedKeys = Object.keys(record).some((key) => !allowedKeys.includes(key));
  if (unexpectedKeys) {
    return undefined;
  }

  const title = normalizeDisplayString(record.title);
  const company = normalizeDisplayString(record.company);
  const location = normalizeDisplayString(record.location);
  const experienceMin = normalizeExperience(record.experienceMin);
  const experienceMax = normalizeExperience(record.experienceMax);
  const applyUrl = normalizeApplyUrl(record.applyUrl);
  const skills = normalizeSkills(record.skills);

  if (
    title === undefined ||
    company === undefined ||
    location === undefined ||
    experienceMin === undefined ||
    experienceMax === undefined ||
    applyUrl === undefined ||
    skills === undefined ||
    experienceMin > experienceMax
  ) {
    return undefined;
  }

  return {
    title,
    company,
    location,
    experienceMin,
    experienceMax,
    applyUrl,
    skills,
  };
}

export function validateAndNormalizeEvent(input: unknown):
  | { valid: true; event: NormalizedEvent }
  | { valid: false; errors: string[] } {
  if (!isRecord(input)) {
    return { valid: false, errors: ["request body must be an object"] };
  }

  const errors: string[] = [];

  const tenantId = normalizeIdentifier(input.tenantId);
  if (tenantId === undefined) {
    errors.push("tenantId is required and must be a non-empty string without surrounding whitespace");
  }

  const sourceId = normalizeIdentifier(input.sourceId);
  if (sourceId === undefined) {
    errors.push("sourceId is required and must be a non-empty string without surrounding whitespace");
  }

  const eventId = normalizeIdentifier(input.eventId);
  if (eventId === undefined) {
    errors.push("eventId is required and must be a non-empty string without surrounding whitespace");
  }

  const externalJobId = normalizeIdentifier(input.externalJobId);
  if (externalJobId === undefined) {
    errors.push("externalJobId is required and must be a non-empty string without surrounding whitespace");
  }

  const version = normalizeVersion(input.version);
  if (version === undefined) {
    errors.push("version must be a safe positive integer");
  }

  const operation = normalizeOperation(input.operation);
  if (operation === undefined) {
    errors.push(`operation must be one of ${EVENT_OPERATIONS.join(", ")}`);
  }

  if (operation === EVENT_OPERATION.UPSERT) {
    const payload = normalizeJobPayload(input.payload);
    if (payload === undefined) {
      errors.push(
        "upsert payload is required and must include title, company, location, experienceMin, experienceMax, applyUrl, and skills with valid values",
      );
    }

    if (
      tenantId === undefined ||
      sourceId === undefined ||
      eventId === undefined ||
      externalJobId === undefined ||
      version === undefined ||
      operation === undefined ||
      payload === undefined
    ) {
      return { valid: false, errors };
    }

    const normalizedEvent: NormalizedEvent = {
      tenantId,
      sourceId,
      eventId,
      externalJobId,
      version,
      operation,
      payload,
    };

    return { valid: true, event: normalizedEvent };
  }

  if (operation === EVENT_OPERATION.ARCHIVE) {
    if (input.payload !== undefined) {
      errors.push("archive payload must be omitted");
    }

    if (
      tenantId === undefined ||
      sourceId === undefined ||
      eventId === undefined ||
      externalJobId === undefined ||
      version === undefined ||
      operation === undefined ||
      input.payload !== undefined
    ) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      event: {
        tenantId,
        sourceId,
        eventId,
        externalJobId,
        version,
        operation,
      },
    };
  }

  return { valid: false, errors };
}
