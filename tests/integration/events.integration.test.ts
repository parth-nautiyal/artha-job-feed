import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import supertest from "supertest";

import { createApp } from "../../src/app.js";
import { EVENTS_COLLECTION } from "../../src/constants/collections.js";
import { createTestMongoContext, type TestMongoContext } from "../helpers/mongo.js";

const baseEvent = {
  tenantId: "tenant-a",
  sourceId: "source-1",
  eventId: "evt-001",
  externalJobId: "job-101",
  version: 1,
  operation: "upsert",
  payload: {
    title: "Senior Engineer",
    company: "Acme Labs",
    location: "Remote",
    experienceMin: 2,
    experienceMax: 5,
    applyUrl: "https://example.com/jobs/101",
    skills: ["TypeScript", "MongoDB", "typescript"],
  },
};

describe("Phase 4 event ingestion integration", () => {
  let context: TestMongoContext | undefined;

  beforeEach(async () => {
    context = await createTestMongoContext();
  });

  afterEach(async () => {
    if (context) {
      await context.cleanup();
      context = undefined;
    }
  });

  it("accepts a new valid event and persists it to MongoDB", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);
    const response = await supertest(app).post("/events").send(baseEvent).expect(202);

    assert.equal(response.body.eventId, baseEvent.eventId);
    assert.equal(response.body.status, "accepted");

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });

  it("replays identical events and stores only one document", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);
    const first = await supertest(app).post("/events").send(baseEvent).expect(202);
    const second = await supertest(app).post("/events").send(baseEvent).expect(200);

    assert.equal(first.body.status, "accepted");
    assert.equal(second.body.status, "replay");

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });

  it("rejects same event identity with different content as a conflict", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);
    await supertest(app).post("/events").send(baseEvent).expect(202);

    const conflicting = {
      ...baseEvent,
      payload: {
        ...baseEvent.payload,
        title: "Different Title",
      },
    };

    const response = await supertest(app).post("/events").send(conflicting).expect(409);
    assert.equal(response.body.error, "event_id_conflict");

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });

  it("accepts a corrected event after an invalid request for the same eventId", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);

    const invalid = {
      ...baseEvent,
      payload: {
        ...baseEvent.payload,
        title: "   ",
      },
    };

    await supertest(app).post("/events").send(invalid).expect(400);

    const valid = await supertest(app).post("/events").send(baseEvent).expect(202);
    assert.equal(valid.body.status, "accepted");

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });

  it("treats different tenant or source combinations as independent events", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);
    const first = { ...baseEvent, tenantId: "tenant-a", sourceId: "source-1", eventId: "evt-001" };
    const second = { ...baseEvent, tenantId: "tenant-b", sourceId: "source-2", eventId: "evt-001" };

    await supertest(app).post("/events").send(first).expect(202);
    await supertest(app).post("/events").send(second).expect(202);

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 2);
  });

  it("handles concurrent identical submissions with exactly one accepted result and one stored document", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);
    const requests = Array.from({ length: 8 }, () => supertest(app).post("/events").send(baseEvent));
    const responses = await Promise.all(requests);

    const acceptedCount = responses.filter((response) => response.status === 202).length;
    const replayCount = responses.filter((response) => response.status === 200).length;
    const conflictCount = responses.filter((response) => response.status === 409).length;
    const serverErrorCount = responses.filter((response) => response.status === 500).length;

    assert.equal(acceptedCount, 1);
    assert.equal(replayCount, 7);
    assert.equal(conflictCount, 0);
    assert.equal(serverErrorCount, 0);

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });

  it("treats object key order as irrelevant but array order as significant for replay detection", async () => {
    if (!context) {
      throw new Error("Mongo test context was not created");
    }

    const app = createApp(context.db);

    const first = {
      tenantId: "tenant-a",
      sourceId: "source-1",
      eventId: "evt-key-order",
      externalJobId: "job-key-order",
      version: 1,
      operation: "upsert",
      payload: {
        title: "Senior Engineer",
        company: "Acme Labs",
        location: "Remote",
        experienceMin: 2,
        experienceMax: 5,
        applyUrl: "https://example.com/jobs/key-order",
        skills: ["typescript", "mongodb"],
      },
    };

    const reorderedKeys = {
      version: 1,
      tenantId: "tenant-a",
      payload: {
        skills: ["typescript", "mongodb"],
        location: "Remote",
        title: "Senior Engineer",
        company: "Acme Labs",
        experienceMax: 5,
        applyUrl: "https://example.com/jobs/key-order",
        experienceMin: 2,
      },
      eventId: "evt-key-order",
      operation: "upsert",
      sourceId: "source-1",
      externalJobId: "job-key-order",
    };

    const reorderedSkills = {
      ...first,
      payload: {
        ...first.payload,
        skills: ["mongodb", "typescript"],
      },
    };

    await supertest(app).post("/events").send(first).expect(202);
    await supertest(app).post("/events").send(reorderedKeys).expect(200);
    await supertest(app).post("/events").send(reorderedSkills).expect(409);

    const count = await context.db.collection(EVENTS_COLLECTION).countDocuments({});
    assert.equal(count, 1);
  });
});
