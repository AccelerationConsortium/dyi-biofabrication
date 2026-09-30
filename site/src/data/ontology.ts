export const ontology = {
  version: "0.1.0",
  title: "DIY Biofabrication Atlas Ontology",
  description:
    "Lightweight public schema for papers, tools, repos, topics, assets, events, and collections in the DIY Biofabrication Atlas.",
  entities: [
    {
      id: "Paper",
      description: "A literature record in the corpus.",
      keyFields: [
        "id",
        "slug",
        "title",
        "doi",
        "year",
        "category",
        "modality",
        "venue",
        "summary",
        "toolIds",
        "repo",
        "assetIds",
        "eventIds",
        "derived.skillLevel",
        "derived.documentationTier",
        "derived.workshopReady"
      ]
    },
    {
      id: "Tool",
      description: "A normalized tool or system name aggregated across one or more papers.",
      keyFields: [
        "id",
        "slug",
        "name",
        "categories",
        "modalities",
        "paperIds",
        "repoIds",
        "assetIds",
        "skillLevels",
        "documentationTier",
        "replicationStatus"
      ]
    },
    {
      id: "Repo",
      description: "An explicit external code, hardware, dataset, or resource link tied to one or more papers.",
      keyFields: ["id", "slug", "name", "url", "kind", "host", "paperIds", "categories", "modalities"]
    },
    {
      id: "Topic",
      description: "A normalized browse cluster derived from category metadata.",
      keyFields: ["id", "slug", "name", "paperIds", "toolIds", "repoIds", "modalities"]
    },
    {
      id: "Asset",
      description: "A derived build-support artifact such as CAD, BOM, protocol, PCB, firmware, schematics, software, or documentation.",
      keyFields: ["id", "slug", "name", "type", "format", "url", "provenanceSource", "paperIds", "toolIds", "repoIds"]
    },
    {
      id: "Event",
      description: "A conference, workshop, or demo context derived from publication venue metadata.",
      keyFields: ["id", "slug", "name", "type", "venue", "url", "provenanceSource", "paperIds"]
    },
    {
      id: "Collection",
      description: "A curated static view derived from transparent heuristics over the corpus.",
      keyFields: ["id", "slug", "name", "description", "rationale", "paperIds"]
    }
  ],
  relations: [
    { id: "DESCRIBES", source: "Paper", target: "Tool", description: "Paper describes a tool or system." },
    { id: "LINKS_TO_REPO", source: "Paper", target: "Repo", description: "Paper links to an external resource or repo." },
    { id: "BELONGS_TO_TOPIC", source: "Paper", target: "Topic", description: "Paper belongs to a normalized topic cluster." },
    { id: "HAS_ASSET", source: "Paper", target: "Asset", description: "Paper has an associated build or documentation asset." },
    { id: "PRESENTED_AT", source: "Paper", target: "Event", description: "Paper is tied to an event-like venue context." },
    { id: "IMPLEMENTS", source: "Repo", target: "Tool", description: "Repo or resource implements or supports a tool." },
    { id: "IN_TOPIC", source: "Tool", target: "Topic", description: "Tool belongs to a topic cluster." },
    { id: "TOOL_HAS_ASSET", source: "Tool", target: "Asset", description: "Tool has an associated build or documentation asset." }
  ],
  controlledFields: {
    assetType: ["cad", "bom", "protocol", "pcb", "firmware", "schematics", "software", "documentation"],
    eventType: ["conference", "workshop", "demo"],
    skillLevel: ["low", "medium", "high"],
    engineeringBarrier: ["low", "medium", "high"],
    documentationTier: ["limited", "moderate", "strong"]
  }
};
