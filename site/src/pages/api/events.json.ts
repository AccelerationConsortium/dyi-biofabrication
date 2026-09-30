import { events } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Event",
    count: events.length,
    items: events
  });
