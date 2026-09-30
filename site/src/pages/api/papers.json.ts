import { papers } from "../../data/loaders";

export const GET = () =>
  Response.json({
    entity: "Paper",
    count: papers.length,
    items: papers.map(({ pdf: _pdf, pageIndex: _pageIndex, evidenceSources: _evidenceSources, ...paper }) => paper)
  });
