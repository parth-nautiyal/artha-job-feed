import express, { type Express } from "express";
import type { Db } from "mongodb";

import { acceptEvent } from "./events/accept.js";
import { validateAndNormalizeEvent } from "./events/validation.js";

export function createApp(db: Db): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/events", async (request, response) => {
    const validation = validateAndNormalizeEvent(request.body);

    if (!validation.valid) {
      response.status(400).json({ error: "invalid_event", details: validation.errors });
      return;
    }

    try {
      const result = await acceptEvent(db, validation.event);

      if (result.kind === "replay") {
        response.status(200).json({ eventId: result.event.eventId, status: "replay" });
        return;
      }

      if (result.kind === "conflict") {
        response.status(409).json({ error: "event_id_conflict", eventId: result.event.eventId });
        return;
      }

      response.status(202).json({ eventId: result.event.eventId, status: "accepted" });
    } catch (error) {
      console.error("Event persistence failed", error);
      response.status(500).json({ error: "event_persistence_failed" });
    }
  });

  return app;
}