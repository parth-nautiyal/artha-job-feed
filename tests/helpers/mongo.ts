import "dotenv/config";

import assert from "node:assert/strict";
import { MongoClient } from "mongodb";

import { initializeMongoDatabase } from "../../src/database/mongodb-init.js";
import { getMongoUri } from "../../src/config/env.js";

export type TestMongoContext = {
  client: MongoClient;
  db: ReturnType<MongoClient["db"]>;
  cleanup: () => Promise<void>;
};

export async function createTestMongoContext(): Promise<TestMongoContext> {
  const uri = getMongoUri();
  assert.ok(uri, "MONGO_URI is required for tests");

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db();
  await db.dropDatabase();
  await initializeMongoDatabase(client);

  return {
    client,
    db,
    cleanup: async () => {
      await db.dropDatabase();
      await client.close();
    },
  };
}
