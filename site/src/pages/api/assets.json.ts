import { assets } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Asset",
    count: assets.length,
    items: assets
  });
