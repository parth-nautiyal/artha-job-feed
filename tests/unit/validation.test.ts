import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateAndNormalizeEvent } from "../../src/events/validation.js";
import { EVENT_OPERATION } from "../../src/models/constants.js";

const baseValidUpsert = {
  tenantId: "tenant-a",
  sourceId: "source-1",
  eventId: "evt-001",
  externalJobId: "job-101",
  version: 1,
  operation: EVENT_OPERATION.UPSERT,
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

function buildInput(overrides: Record<string, unknown> = {}) {
  return { ...baseValidUpsert, ...overrides };
}

describe("validateAndNormalizeEvent", () => {
  it("accepts a valid upsert event", () => {
    const result = validateAndNormalizeEvent(baseValidUpsert);

    assert.equal(result.valid, true);
    if (!result.valid) {
      return;
    }

    assert.deepEqual(result.event, {
      tenantId: "tenant-a",
      sourceId: "source-1",
      eventId: "evt-001",
      externalJobId: "job-101",
      version: 1,
      operation: EVENT_OPERATION.UPSERT,
      payload: {
        title: "Senior Engineer",
        company: "Acme Labs",
        location: "Remote",
        experienceMin: 2,
        experienceMax: 5,
        applyUrl: "https://example.com/jobs/101",
        skills: ["typescript", "mongodb"],
      },
    });
  });

  it("accepts a valid archive event without payload", () => {
    const result = validateAndNormalizeEvent({
      tenantId: "tenant-a",
      sourceId: "source-1",
      eventId: "evt-archive",
      externalJobId: "job-archive",
      version: 2,
      operation: EVENT_OPERATION.ARCHIVE,
    });

    assert.equal(result.valid, true);
    if (!result.valid) {
      return;
    }

    assert.deepEqual(result.event, {
      tenantId: "tenant-a",
      sourceId: "source-1",
      eventId: "evt-archive",
      externalJobId: "job-archive",
      version: 2,
      operation: EVENT_OPERATION.ARCHIVE,
    });
  });

  it("trims display strings before constructing the normalized payload", () => {
    const result = validateAndNormalizeEvent(
      buildInput({
        payload: {
          title: "  Senior Engineer  ",
          company: "  Acme Labs  ",
          location: "  Remote  ",
          experienceMin: 1,
          experienceMax: 4,
          applyUrl: "https://example.com/jobs/trimmed",
          skills: [" TypeScript ", "MongoDB"],
        },
      }),
    );

    assert.equal(result.valid, true);
    if (!result.valid) {
      return;
    }

    assert.equal(result.event.payload?.title, "Senior Engineer");
    assert.equal(result.event.payload?.company, "Acme Labs");
    assert.equal(result.event.payload?.location, "Remote");
  });

  it("normalizes skills by trimming, lowercasing, deduplicating, and preserving first occurrence order", () => {
    const result = validateAndNormalizeEvent(
      buildInput({
        payload: {
          title: "Developer",
          company: "Acme",
          location: "Remote",
          experienceMin: 1,
          experienceMax: 4,
          applyUrl: "https://example.com/jobs/skills",
          skills: [" TypeScript ", "MongoDB", "typescript", " MongoDB ", "node", "Node"],
        },
      }),
    );

    assert.equal(result.valid, true);
    if (!result.valid) {
      return;
    }

    assert.deepEqual(result.event.payload?.skills, ["typescript", "mongodb", "node"]);
  });

  it("rejects invalid identifier values without trimming them", () => {
    const identifierFields = ["tenantId", "sourceId", "eventId", "externalJobId"] as const;

    for (const field of identifierFields) {
      const invalidCases = [undefined, "", " ", " tenant-a", "tenant-a ", 123, null];

      for (const invalid of invalidCases) {
        const input = buildInput({ [field]: invalid });
        const result = validateAndNormalizeEvent(input);

        assert.equal(result.valid, false, `${field} accepted invalid value ${JSON.stringify(invalid)}`);
      }
    }
  });

  it("rejects invalid version values", () => {
    const invalidVersions = [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", NaN];

    for (const value of invalidVersions) {
      const input = buildInput({ version: value });
      const result = validateAndNormalizeEvent(input);
      assert.equal(result.valid, false, `version ${String(value)} should be rejected`);
    }

    const valid = validateAndNormalizeEvent(buildInput({ version: 7 }));
    assert.equal(valid.valid, true);
  });

  it("accepts only upsert and archive operations", () => {
    const validUpsert = validateAndNormalizeEvent(baseValidUpsert);
    assert.equal(validUpsert.valid, true);

    const validArchive = validateAndNormalizeEvent({
      ...baseValidUpsert,
      operation: EVENT_OPERATION.ARCHIVE,
      payload: undefined,
    });
    assert.equal(validArchive.valid, true);

    for (const operation of ["create", "update", "delete", "merge", "", null]) {
      const result = validateAndNormalizeEvent(buildInput({ operation }));
      assert.equal(result.valid, false, `operation ${String(operation)} should be rejected`);
    }
  });

  it("requires payload for upsert and rejects non-object payloads", () => {
    const missingPayload = validateAndNormalizeEvent({
      ...baseValidUpsert,
      payload: undefined,
    });
    assert.equal(missingPayload.valid, false);

    const nonObjectPayload = validateAndNormalizeEvent({
      ...baseValidUpsert,
      payload: "not-an-object",
    });
    assert.equal(nonObjectPayload.valid, false);
  });

  it("validates required display fields and experience boundaries", () => {
    const invalidDisplayCases = [
      { title: "" },
      { title: "   " },
      { company: "" },
      { company: "   " },
      { location: "" },
      { location: "   " },
    ];

    for (const invalid of invalidDisplayCases) {
      const result = validateAndNormalizeEvent(
        buildInput({
          payload: {
            ...baseValidUpsert.payload,
            ...invalid,
          },
        }),
      );
      assert.equal(result.valid, false, `display field should have been rejected: ${JSON.stringify(invalid)}`);
    }

    for (const value of [-1, -2, 51, 100]) {
      const minResult = validateAndNormalizeEvent(
        buildInput({
          payload: {
            ...baseValidUpsert.payload,
            experienceMin: value,
          },
        }),
      );
      assert.equal(minResult.valid, false, `experienceMin ${value} should be rejected`);
    }

    for (const value of [-1, -2, 51, 100]) {
      const maxResult = validateAndNormalizeEvent(
        buildInput({
          payload: {
            ...baseValidUpsert.payload,
            experienceMax: value,
          },
        }),
      );
      assert.equal(maxResult.valid, false, `experienceMax ${value} should be rejected`);
    }

    const minAboveMax = validateAndNormalizeEvent(
      buildInput({
        payload: {
          ...baseValidUpsert.payload,
          experienceMin: 10,
          experienceMax: 7,
        },
      }),
    );
    assert.equal(minAboveMax.valid, false);
  });

  it("requires valid applyUrl and skills values", () => {
    const invalidApplyUrl = validateAndNormalizeEvent(
      buildInput({
        payload: {
          ...baseValidUpsert.payload,
          applyUrl: "http://example.com/job",
        },
      }),
    );
    assert.equal(invalidApplyUrl.valid, false);

    const malformedApplyUrl = validateAndNormalizeEvent(
      buildInput({
        payload: {
          ...baseValidUpsert.payload,
          applyUrl: "not-a-url",
        },
      }),
    );
    assert.equal(malformedApplyUrl.valid, false);

    const missingSkills = validateAndNormalizeEvent(
      buildInput({
        payload: {
          ...baseValidUpsert.payload,
          skills: undefined,
        },
      }),
    );
    assert.equal(missingSkills.valid, false);

    const invalidSkillEntries = validateAndNormalizeEvent(
      buildInput({
        payload: {
          ...baseValidUpsert.payload,
          skills: ["valid", "", "  ", 123],
        },
      }),
    );
    assert.equal(invalidSkillEntries.valid, false);
  });

  it("rejects archive events that include a payload", () => {
    const result = validateAndNormalizeEvent({
      tenantId: "tenant-a",
      sourceId: "source-1",
      eventId: "evt-archive-payload",
      externalJobId: "job-archive-payload",
      version: 1,
      operation: EVENT_OPERATION.ARCHIVE,
      payload: {
        title: "Job",
        company: "Acme",
        location: "Remote",
        experienceMin: 1,
        experienceMax: 2,
        applyUrl: "https://example.com/job",
        skills: ["node"],
      },
    });

    assert.equal(result.valid, false);
  });
});
