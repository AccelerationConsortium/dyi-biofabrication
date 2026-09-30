/** Result of the periodic repo/design-file reachability check (check-repo-accessibility.mjs). */
export interface RepoAccessibility {
  checked: boolean;
  accessible: boolean | null;
  httpStatus?: number | null;
  /** ISO timestamp of the most recent upstream activity (GitHub: pushed_at). Empty if the host doesn't report one. */
  lastActivity: string;
  lastActivitySource: string;
  archived: boolean;
  license?: string;
  /** ISO timestamp of when we ran the check. */
  checkedAt: string;
}

export interface RepoLink {
  id: string;
  slug: string;
  name: string;
  url: string;
  kind: string;
  accessibility?: RepoAccessibility;
}

export interface RepoRecord {
  id: string;
  slug: string;
  name: string;
  url: string;
  kind: string;
  accessibility?: RepoAccessibility;
  host: string;
  paperIds: string[];
  paperSlugs: string[];
  paperTitles: string[];
  categories: string[];
  modalities: string[];
  paperCount: number;
}

export interface AssetRecord {
  id: string;
  slug: string;
  name: string;
  type: string;
  format: string;
  evidence: string;
  url: string;
  provenanceSource: "manifest" | "heuristic";
  notes: string;
  paperIds: string[];
  paperSlugs: string[];
  toolIds: string[];
  toolSlugs: string[];
  repoIds: string[];
  repoSlugs: string[];
  paperCount: number;
  toolCount: number;
}

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  type: string;
  venue: string;
  url: string;
  provenanceSource: "manifest" | "heuristic";
  notes: string;
  paperIds: string[];
  paperSlugs: string[];
  paperTitles: string[];
  paperCount: number;
}

export interface ToolRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  aliases: string[];
  paperIds: string[];
  paperSlugs: string[];
  paperTitles: string[];
  categories: string[];
  modalities: string[];
  repoIds: string[];
  repoSlugs: string[];
  skillTags: string[];
  skillLevels: string[];
  buildComplexities: string[];
  documentationScore: number;
  documentationTier: string;
  workshopPaperCount: number;
  replicationStatus: string;
  assetIds: string[];
  assetSlugs: string[];
  assetTypes: string[];
  paperCount: number;
  repoCount: number;
  perspectiveSnippet?: string;
}

export interface SkillRecord {
  id: string;
  slug: string;
  name: string;
  kind: "level" | "tag";
  level: string | null;
  paperIds: string[];
  paperSlugs: string[];
  toolIds: string[];
  toolSlugs: string[];
  assetIds: string[];
  skillLevels: string[];
  paperCount: number;
  toolCount: number;
}

export interface TopicRecord {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  paperIds: string[];
  paperSlugs: string[];
  paperTitles: string[];
  modalities: string[];
  repoIds: string[];
  repoSlugs: string[];
  toolIds: string[];
  toolSlugs: string[];
  paperCount: number;
  repoCount: number;
  toolCount: number;
}

export interface CriterionScore {
  id: string;
  name: string;
  /** Column heading shortened for tables; falls back to name. */
  shortName: string;
  value: number | null;
  rationale: string;
  /** False when this criterion cannot separate one build from another across the corpus. */
  display: boolean;
  /** Lowest and highest score any build in the corpus receives on this criterion. */
  observedMin: number | null;
  observedMax: number | null;
}

export interface CriteriaAssessment {
  assessed: boolean;
  rubricMapped: boolean;
  technologyType: string;
  averageScore: number | null;
  scoredCriteriaCount: number;
  /** How many of the scored criteria the site actually shows. */
  displayedCriteriaCount: number;
  criteria: CriterionScore[];
}

export interface CriteriaRubricScoreAnchor {
  value: number;
  anchor: string;
}

export interface CriteriaRubricTechnology {
  type: string;
  informationToExtract: string;
  scores: CriteriaRubricScoreAnchor[];
}

export interface CriteriaRubricCriterion {
  id: string;
  name: string;
  description: string;
  technologies: CriteriaRubricTechnology[];
}

export interface PublicationAuthor {
  name: string;
  orcid?: string;
  institutions?: string[];
  affiliations?: string[];
  countries?: string[];
  corresponding?: boolean;
}

export interface PublicationMetadata {
  paperTitle: string;
  requestedDoi: string;
  resolvedDoi: string;
  matchMethod: "doi" | "title" | "none";
  matchScore: number;
  fetchedAt: string;
  abstract: string;
  authors: PublicationAuthor[];
  crossref: null | {
    doi: string;
    url: string;
    title: string;
    subtitle: string;
    publisher: string;
    journal: string;
    publishedDate: string;
    type: string;
    language: string;
    volume: string;
    issue: string;
    pages: string;
    issn: string[];
    subjects: string[];
    referencesCount: number;
    citedByCount: number;
    licenses: string[];
    funders: Array<{ name: string; doi: string; awards: string[] }>;
    fullTextLinks: Array<{ url: string; contentType: string; version: string }>;
  };
  openAlex: null | {
    id: string;
    doi: string;
    url: string;
    title: string;
    publicationDate: string;
    publicationYear: number | null;
    type: string;
    language: string;
    citedByCount: number;
    referencesCount: number;
    isRetracted: boolean;
    openAccess: {
      isOpen: boolean;
      status: string;
      url: string;
      pdfUrl: string;
      license: string;
      version: string;
      repositoryHasFullText: boolean;
    };
    source: string;
    topics: string[];
    keywords: string[];
    grants: Array<{ funder: string; awardId: string }>;
  };
}

export interface PaperRecord {
  id: string;
  slug: string;
  title: string;
  doi: string;
  publication: PublicationMetadata | null;
  primaryLink: string;
  year: number | null;
  venue: string;
  type: string;
  category: string[];
  modality: string[];
  systemOrTechnology: string;
  inclusionFit: string;
  summary: string;
  whyItMatters: string;
  motivationUseCase: string;
  limitation: string;
  function: string;
  keySources: string;
  openSourceResources: string;
  sourceWorkbooks: string[];
  sourceScope: "curated" | "supplemental";
  mappingConfidence: "high" | "medium" | "low";
  buildComplexity: string;
  technicalSkillsNeeded: string[];
  approximateCost: string;
  /** Where approximateCost came from: the curated workbook, or the criteria assessment fallback. */
  approximateCostSource: "curated workbook" | "criteria assessment" | "";
  openSource: boolean | null;
  lowCost: boolean | null;
  easyToBuild: boolean | null;
  easyToUse: boolean | null;
  repo: RepoLink | null;
  pdf: {
    available: boolean;
    localPath: string;
    publicPath: string;
    sourceUrl: string;
    status: string;
  };
  pageIndex: {
    available: boolean;
    status: string;
    outputPath: string;
    publicPath: string;
  };
  tags: string[];
  democratizingFeatures: string[];
  evidenceSources: string[];
  toolIds: string[];
  toolSlugs: string[];
  toolNames: string[];
  topicIds: string[];
  topicSlugs: string[];
  topicNames: string[];
  assetIds: string[];
  assetSlugs: string[];
  assetTypes: string[];
  eventIds: string[];
  eventSlugs: string[];
  eventNames: string[];
  criteriaAssessment: CriteriaAssessment;
  derived: {
    skillLevel: "low" | "medium" | "high";
    engineeringBarrier: "low" | "medium" | "high";
    documentationScore: number;
    documentationTier: "strong" | "moderate" | "limited";
    workshopReady: boolean;
    evidenceRich: boolean;
  };
}

export interface CollectionRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  rationale: string;
  paperIds: string[];
  paperSlugs: string[];
  paperCount: number;
}

export interface PageIndexChunkRecord {
  id: string;
  slug: string;
  url: string;
  paperId: string;
  paperSlug: string;
  paperTitle: string;
  paperUrl: string;
  nodeId: string;
  title: string;
  summary: string;
  level: number;
  startIndex: number | null;
  endIndex: number | null;
  pageSpanLabel: string;
  parentNodeId: string;
  parentChunkId: string;
  parentChunkSlug: string;
  childNodeIds: string[];
  childChunkIds: string[];
  childChunkSlugs: string[];
  category: string[];
  modality: string[];
  topicIds: string[];
  topicSlugs: string[];
  topicNames: string[];
  toolIds: string[];
  toolSlugs: string[];
  toolNames: string[];
  assetIds: string[];
  assetSlugs: string[];
  assetTypes: string[];
  eventIds: string[];
  eventSlugs: string[];
  eventNames: string[];
  repoIds: string[];
  repoSlugs: string[];
  repoNames: string[];
  hasPdf: boolean;
  hasPageIndex: boolean;
  workshopReady: boolean;
  documentationTier: "strong" | "moderate" | "limited";
  pageIndexPublicPath: string;
  pageIndexOutputPath: string;
  searchText: string;
  semanticText: string;
  semanticSignals: string[];
}

export interface SiteStats {
  paperCount: number;
  curatedPaperCount: number;
  supplementalPaperCount: number;
  mappedToolPaperCount: number;
  criteriaAssessedCount: number;
  criteriaMappedCount: number;
  pdfCount: number;
  pageIndexCount: number;
  pageIndexChunkCount: number;
  repoCount: number;
  toolCount: number;
  topicCount: number;
  assetCount: number;
  eventCount: number;
  skillCount: number;

  /** Provenance figures the manuscript cites, counted from the corpus at build time. */
  yearMin: number;
  yearMax: number;
  openAccessCount: number;
  closedAccessCount: number;
  /** Records with no OpenAlex entry: access and retraction status are unknown, not negative. */
  accessUnknownCount: number;
  retractionCheckedCount: number;
  retractedCount: number;
  doiCount: number;
  costStatedCount: number;
  licenceCount: number;
  reachableRepoCount: number;
  unverifiedRepoLinkCount: number;
  fullTextHeldCount: number;
  standardComplianceCount: number;

  categoryCounts: Array<{ label: string; count: number }>;
}

export interface RetrievalHit {
  id: string;
  kind: "entity" | "chunk";
  mode: "keyword" | "semantic" | "hybrid";
  title: string;
  url: string;
  paperSlug: string;
  paperTitle: string;
  entityType: string;
  score: number;
  explanation: string;
  matchedSectionTitle: string;
  pageSpanLabel: string;
  relatedToolNames: string[];
  relatedTopicNames: string[];
  relatedAssetTypes: string[];
  relatedRepoNames: string[];
}

export interface GraphNode {
  id: string;
  type: "paper" | "tool" | "topic" | "repo" | "asset" | "event";
  slug: string;
  label: string;
  meta: string;
  url: string;
  topicIds?: string[];
  topicSlugs?: string[];
  topicNames?: string[];
  criteriaAssessed?: boolean;
  criteriaRubricMapped?: boolean;
  criteriaTechnologyType?: string;
  criteriaAverage?: number | null;
  criteriaScores?: Record<string, number | null>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  criteria: Array<{ id: string; name: string }>;
  counts: {
    papers: number;
    tools: number;
    topics: number;
    repos: number;
    assets: number;
    events: number;
    edges: number;
  };
}

export interface CriterionStat {
  id: string;
  name: string;
  shortName: string;
  scoredCount: number;
  totalCount: number;
  observedMin: number | null;
  observedMax: number | null;
  modeShare: number;
  /** False when the criterion cannot separate one build from another; see withheldReason. */
  display: boolean;
  withheldReason: string;
}
