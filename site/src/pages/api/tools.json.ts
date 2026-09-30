import { tools } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Tool",
    count: tools.length,
    items: tools
  });
