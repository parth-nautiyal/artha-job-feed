import { MongoServerError, type Db } from "mongodb";

import { EVENTS_COLLECTION } from "../constants/collections.js";
import { EVENT_STATUS } from "../models/constants.js";
import type { EventDocument, NormalizedEvent } from "../models/event.model.js";

export type AcceptedEventResult =
  | { kind: "accepted"; event: EventDocument }
  | { kind: "replay"; event: EventDocument }
  | { kind: "conflict"; event: EventDocument };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }

  return value;
}

function sameEventContent(left: NormalizedEvent, right: NormalizedEvent): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function normalizedEventFromDocument(document: EventDocument): NormalizedEvent {
  const event: NormalizedEvent = {
    tenantId: document.tenantId,
    sourceId: document.sourceId,
    eventId: document.eventId,
    externalJobId: document.externalJobId,
    version: document.version,
    operation: document.operation,
  };

  if (document.payload !== undefined) {
    event.payload = document.payload;
  }

  return event;
}

function compareWithExisting(
  existing: EventDocument,
  incoming: NormalizedEvent,
): AcceptedEventResult {
  return sameEventContent(normalizedEventFromDocument(existing), incoming)
    ? { kind: "replay", event: existing }
    : { kind: "conflict", event: existing };
}

export async function acceptEvent(
  db: Db,
  normalizedEvent: NormalizedEvent,
): Promise<AcceptedEventResult> {
  const events = db.collection<EventDocument>(EVENTS_COLLECTION);
  const identity = {
    tenantId: normalizedEvent.tenantId,
    sourceId: normalizedEvent.sourceId,
    eventId: normalizedEvent.eventId,
  };
  const existing = await events.findOne(identity);

  if (existing) {
    return compareWithExisting(existing, normalizedEvent);
  }

  const now = new Date();
  const document: EventDocument = {
    ...normalizedEvent,
    status: EVENT_STATUS.PENDING,
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const insertResult = await events.insertOne(document);
    if (!insertResult.acknowledged) {
      throw new Error("MongoDB did not acknowledge the event insert");
    }

    return { kind: "accepted", event: document };
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }

    const concurrentEvent = await events.findOne(identity);
    if (!concurrentEvent) {
      throw error;
    }

    return compareWithExisting(concurrentEvent, normalizedEvent);
  }
}
