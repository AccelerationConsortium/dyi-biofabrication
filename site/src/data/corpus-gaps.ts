import { costBand, parseCost } from "./cost";
import { papers } from "./loaders";

/**
 * What the corpus records, and what it does not.
 *
 * These are the manuscript's own figures, and the home page leads with them, so they are
 * counted here once rather than in each page that shows them.
 *
 * They deliberately do not come from stats.json. `costStatedCount` there counts a non-empty
 * string, and two records hold "???" and "N/A (built on ~$7k OT-2)" -- statements that no
 * figure exists, counted as figures. Running the same parse the index runs means the number
 * on the home page and the "Not stated" checkbox on /browse cannot name different sets.
 */

const total = papers.length;

const missingCost = papers.filter(
  (p) => !costBand(parseCost((p.approximateCost || "").split("|")[0].trim()).value)
).length;
const missingLicence = papers.filter((p) => !p.artifactLicence?.value).length;
const missingRepo = papers.filter((p) => !p.repo && !(p.textRepoLinks ?? [])[0]).length;
const rebuilt = papers.filter((p) => (p.rebuildReports?.length ?? 0) > 0).length;
const againstStandard = papers.filter(
  (p) => (p.reportedMetrics?.metrics ?? []).some((m) => m.id === "standard-compliance" && m.status === "yes")
).length;

export const corpusTotal = total;

/**
 * Each gap links to the filtered catalogue rather than only stating a number, so a reader
 * who wants to know *which* records are missing a cost gets the list. The query keys are
 * the facet keys in browse.astro.
 */
export const gaps = [
  { id: "cost", count: missingCost, label: "state no cost", href: "/browse?costband=none" },
  { id: "licence", count: missingLicence, label: "state no licence", href: "/browse?licstate=no" },
  { id: "repo", count: missingRepo, label: "publish no design files", href: "/browse?repostate=none" }
];

/** The corpus as it stands, for the figures that are not gaps. */
export const holdings = {
  total,
  rebuilt,
  againstStandard,
  withCost: total - missingCost,
  withLicence: total - missingLicence,
  withRepo: total - missingRepo
};
