import { collections } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Collection",
    count: collections.length,
    items: collections
  });
