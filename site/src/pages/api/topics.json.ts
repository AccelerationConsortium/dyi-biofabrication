import { topics } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Topic",
    count: topics.length,
    items: topics
  });
