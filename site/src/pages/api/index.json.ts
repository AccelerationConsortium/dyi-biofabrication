import { endpoints } from "../../data/api-endpoints";
import { ontology } from "../../data/ontology";

/** The machine-readable endpoint directory. /api is the human-readable version. */
export const GET = () =>
  Response.json({
    title: "DIY Biofabrication Atlas API",
    version: ontology.version,
    documentation: "/api",
    endpoints: endpoints.map(({ path, entity, description, items }) => ({
      path,
      entity,
      count: items.length,
      description
    }))
  });
