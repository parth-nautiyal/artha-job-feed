import { MongoClient } from "mongodb";

import { getMongoUri } from "../config/env.js";

let client: MongoClient | undefined;

export async function connectToMongo(): Promise<MongoClient> {
  const uri = getMongoUri();

  if (!uri) {
    throw new Error("MONGO_URI is required");
  }

  if (client) {
    return client;
  }

  const nextClient = new MongoClient(uri);

  try {
    await nextClient.connect();
    await nextClient.db().command({ ping: 1 });
    client = nextClient;
    return nextClient;
  } catch (error) {
    await nextClient.close();
    throw error;
  }
}

export async function closeMongo(): Promise<void> {
  if (!client) {
    return;
  }

  await client.close();
  client = undefined;
}