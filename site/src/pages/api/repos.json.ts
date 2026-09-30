import { repos } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Repo",
    count: repos.length,
    items: repos
  });
