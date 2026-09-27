import { MongoServerError, type Db, type MongoClient } from "mongodb";

import { EVENTS_COLLECTION, JOBS_COLLECTION } from "../constants/collections.js";
import type { EventDocument } from "../models/event.model.js";
import type { JobDocument } from "../models/job.model.js";

async function ensureCollection(db: Db, name: string): Promise<void> {
  try {
    await db.createCollection(name);
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 48) {
      throw error;
    }
  }
}

export async function initializeMongoDatabase(client: MongoClient): Promise<void> {
  const db = client.db();

  await ensureCollection(db, EVENTS_COLLECTION);
  await ensureCollection(db, JOBS_COLLECTION);

  await db.collection<EventDocument>(EVENTS_COLLECTION).createIndex(
    { tenantId: 1, sourceId: 1, eventId: 1 },
    { name: "event_identity_unique", unique: true },
  );

  await db.collection<EventDocument>(EVENTS_COLLECTION).createIndex(
    { status: 1, nextAttemptAt: 1 },
    { name: "event_work_eligibility" },
  );

  await db.collection<JobDocument>(JOBS_COLLECTION).createIndex(
    { tenantId: 1, sourceId: 1, externalJobId: 1 },
    { name: "job_identity_unique", unique: true },
  );
}