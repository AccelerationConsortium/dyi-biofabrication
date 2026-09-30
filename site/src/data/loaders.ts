import papersData from "./generated/papers.json";
import reposData from "./generated/repos.json";
import toolsData from "./generated/tools.json";
import topicsData from "./generated/topics.json";
import assetsData from "./generated/assets.json";
import eventsData from "./generated/events.json";
import graphData from "./generated/graph.json";
import collectionsData from "./generated/collections.json";
import skillsData from "./generated/skills.json";
import statsData from "./generated/stats.json";
import criteriaRubricData from "./generated/criteria_rubric.json";
import criteriaStatsData from "./generated/criteria_stats.json";
import screeningData from "./generated/screening.json";
import type { AssetRecord, CollectionRecord, CriteriaRubricCriterion, EventRecord, GraphData, PaperRecord, RepoRecord, SiteStats, SkillRecord, ToolRecord, TopicRecord } from "./types";

export const papers = papersData as PaperRecord[];
export const repos = reposData as RepoRecord[];
export const tools = toolsData as ToolRecord[];
export const topics = topicsData as TopicRecord[];
export const assets = assetsData as AssetRecord[];
export const events = eventsData as EventRecord[];
export const graph = graphData as GraphData;
export const collections = collectionsData as CollectionRecord[];
export const skills = skillsData as SkillRecord[];
export const stats = statsData as SiteStats;
export const criteriaRubric = criteriaRubricData as CriteriaRubricCriterion[];

/** Per-criterion coverage and spread across the corpus, and whether the site shows it. */
export const criteriaStats = criteriaStatsData as CriterionStat[];

export interface ScreenedPaper {
  title: string;
  doi: string;
  technologyType: string;
  keep: boolean;
  group?: string;
}
export interface Screening {
  screened: number;
  kept: number;
  inCorpus: number;
  excludedCount: number;
  groups: { group: string; count: number }[];
  excluded: ScreenedPaper[];
}
export const screening = screeningData as Screening;
