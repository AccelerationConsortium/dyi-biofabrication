import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const papersPath = path.join(siteRoot, "src", "data", "generated", "papers.json");
const outputPath = path.join(siteRoot, "src", "data", "enrichment", "publication_metadata.json");
const refresh = process.argv.includes("--refresh");
const USER_AGENT = "DIY-Biofabrication-Atlas/1.0 (publication metadata enrichment)";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const titleKey = (value) => clean(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const titleTokens = (value) => new Set(titleKey(value).split(" ").filter((token) => token.length > 2));
const similarity = (a, b) => {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return (2 * intersection) / (left.size + right.size);
};

const doiCandidates = (value) => clean(value)
  .split("|")
  .map((part) => part.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/\/full$/, ""))
  .map((part) => part.match(/10\.\d{4,9}\/[^\s]+/i)?.[0]?.replace(/[.,;]+$/, "") || "")
  .filter(Boolean);

const decodeEntities = (value) => String(value || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, " ")
  .trim();

const dateFromParts = (source) => {
  const parts = source?.["date-parts"]?.[0];
  if (!parts?.length) return "";
  return [parts[0], String(parts[1] || 1).padStart(2, "0"), String(parts[2] || 1).padStart(2, "0")].join("-");
};

const reconstructAbstract = (index) => {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions || []) words[position] = word;
  }
  return clean(words.join(" "));
};

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) return null;
  return response.json();
}

const crossrefByDoi = async (doi) => (await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`))?.message || null;
const openAlexByDoi = async (doi) => fetchJson(`https://api.openalex.org/works/https://doi.org/${doi}`);
const crossrefByTitle = async (title) => (await fetchJson(`https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=3&select=DOI,title,author,published,published-online,published-print,container-title,publisher,type,URL,abstract,is-referenced-by-count,reference-count,license,subject,ISSN,volume,issue,page,language,link,funder`))?.message?.items || [];
const openAlexByTitle = async (title) => (await fetchJson(`https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=3`))?.results || [];

function normalizeCrossref(work) {
  if (!work) return null;
  const published = work["published-print"] || work["published-online"] || work.published || work.issued;
  return {
    doi: clean(work.DOI).toLowerCase(),
    url: clean(work.URL),
    title: clean(work.title?.[0]),
    subtitle: clean(work.subtitle?.[0]),
    abstract: decodeEntities(work.abstract),
    authors: (work.author || []).map((author) => ({
      name: clean(author.name || [author.given, author.family].filter(Boolean).join(" ")),
      given: clean(author.given),
      family: clean(author.family),
      orcid: clean(author.ORCID),
      affiliations: (author.affiliation || []).map((item) => clean(item.name)).filter(Boolean)
    })),
    publisher: clean(work.publisher),
    journal: clean(work["container-title"]?.[0]),
    publishedDate: dateFromParts(published),
    type: clean(work.type),
    language: clean(work.language),
    volume: clean(work.volume),
    issue: clean(work.issue),
    pages: clean(work.page),
    issn: [...new Set(work.ISSN || [])],
    subjects: [...new Set((work.subject || []).map(clean).filter(Boolean))],
    referencesCount: Number(work["reference-count"] || 0),
    citedByCount: Number(work["is-referenced-by-count"] || 0),
    licenses: (work.license || []).map((item) => clean(item.URL)).filter(Boolean),
    funders: (work.funder || []).map((item) => ({ name: clean(item.name), doi: clean(item.DOI), awards: item.award || [] })),
    fullTextLinks: (work.link || []).map((item) => ({ url: clean(item.URL), contentType: clean(item["content-type"]), version: clean(item["content-version"]) })).filter((item) => item.url)
  };
}

function normalizeOpenAlex(work) {
  if (!work) return null;
  const location = work.best_oa_location || work.primary_location || {};
  return {
    id: clean(work.id),
    doi: clean(work.doi).replace(/^https?:\/\/doi\.org\//, "").toLowerCase(),
    url: clean(work.id),
    title: clean(work.display_name || work.title),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    authors: (work.authorships || []).map((item) => ({
      name: clean(item.author?.display_name),
      orcid: clean(item.author?.orcid),
      institutions: (item.institutions || []).map((institution) => clean(institution.display_name)).filter(Boolean),
      countries: [...new Set((item.countries || []).filter(Boolean))],
      corresponding: Boolean(item.is_corresponding)
    })),
    publicationDate: clean(work.publication_date),
    publicationYear: Number(work.publication_year) || null,
    type: clean(work.type),
    language: clean(work.language),
    citedByCount: Number(work.cited_by_count || 0),
    referencesCount: Number(work.referenced_works_count || 0),
    isRetracted: Boolean(work.is_retracted),
    openAccess: {
      isOpen: Boolean(work.open_access?.is_oa),
      status: clean(work.open_access?.oa_status),
      url: clean(work.open_access?.oa_url || location.landing_page_url),
      pdfUrl: clean(location.pdf_url),
      license: clean(location.license),
      version: clean(location.version),
      repositoryHasFullText: Boolean(work.open_access?.any_repository_has_fulltext)
    },
    source: clean(location.source?.display_name || work.primary_location?.source?.display_name),
    topics: (work.topics || []).slice(0, 8).map((item) => clean(item.display_name)).filter(Boolean),
    keywords: (work.keywords || []).slice(0, 12).map((item) => clean(item.display_name)).filter(Boolean),
    grants: (work.grants || []).map((item) => ({ funder: clean(item.funder_display_name), awardId: clean(item.award_id) }))
  };
}

async function resolvePaper(paper) {
  const candidates = doiCandidates(paper.doi);
  let crossref = null;
  let openAlex = null;
  let matchMethod = "none";
  let matchScore = 0;

  if (candidates.length) {
    const matches = await Promise.all(candidates.map(async (doi) => {
      const [crossrefWork, openAlexWork] = await Promise.all([crossrefByDoi(doi), openAlexByDoi(doi)]);
      const resolvedTitle = openAlexWork?.display_name || crossrefWork?.title?.[0] || "";
      return { doi, crossrefWork, openAlexWork, score: similarity(paper.title, resolvedTitle) };
    }));
    matches.sort((a, b) => b.score - a.score);
    const best = matches[0];
    crossref = normalizeCrossref(best?.crossrefWork);
    openAlex = normalizeOpenAlex(best?.openAlexWork);
    matchMethod = "doi";
    matchScore = best?.score || 0;
  } else {
    const [crossrefCandidates, openAlexCandidates] = await Promise.all([crossrefByTitle(paper.title), openAlexByTitle(paper.title)]);
    const bestOpenAlex = openAlexCandidates
      .map((work) => ({ work, score: similarity(paper.title, work.display_name || work.title) }))
      .sort((a, b) => b.score - a.score)[0];
    const bestCrossref = crossrefCandidates
      .map((work) => ({ work, score: similarity(paper.title, work.title?.[0]) }))
      .sort((a, b) => b.score - a.score)[0];
    if ((bestOpenAlex?.score || 0) >= 0.78) openAlex = normalizeOpenAlex(bestOpenAlex.work);
    if ((bestCrossref?.score || 0) >= 0.78) crossref = normalizeCrossref(bestCrossref.work);
    const resolvedDoi = openAlex?.doi || crossref?.doi;
    if (resolvedDoi) {
      const [crossrefWork, openAlexWork] = await Promise.all([
        crossref ? null : crossrefByDoi(resolvedDoi),
        openAlex ? null : openAlexByDoi(resolvedDoi)
      ]);
      crossref ||= normalizeCrossref(crossrefWork);
      openAlex ||= normalizeOpenAlex(openAlexWork);
    }
    matchMethod = crossref || openAlex ? "title" : "none";
    matchScore = Math.max(bestOpenAlex?.score || 0, bestCrossref?.score || 0);
  }

  const abstract = openAlex?.abstract || crossref?.abstract || "";
  return {
    paperTitle: paper.title,
    requestedDoi: paper.doi,
    resolvedDoi: openAlex?.doi || crossref?.doi || candidates[0] || "",
    matchMethod,
    matchScore: Math.round(matchScore * 100) / 100,
    fetchedAt: new Date().toISOString(),
    abstract,
    authors: openAlex?.authors?.length ? openAlex.authors : crossref?.authors || [],
    crossref,
    openAlex
  };
}

const papers = JSON.parse(fs.readFileSync(papersPath, "utf8"));
const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : { records: {} };
const records = refresh ? {} : { ...(existing.records || {}) };
let cursor = 0;

async function worker() {
  while (cursor < papers.length) {
    const index = cursor++;
    const paper = papers[index];
    const key = titleKey(paper.title);
    if (!refresh && records[key]?.matchMethod && records[key].matchMethod !== "none") continue;
    try {
      records[key] = await resolvePaper(paper);
      console.log(`${index + 1}/${papers.length} ${records[key].matchMethod}: ${paper.title}`);
    } catch (error) {
      records[key] = { paperTitle: paper.title, requestedDoi: paper.doi, matchMethod: "none", matchScore: 0, fetchedAt: new Date().toISOString(), abstract: "", authors: [], crossref: null, openAlex: null, error: String(error.message || error) };
      console.warn(`${index + 1}/${papers.length} failed: ${paper.title}`);
    }
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
const matched = Object.values(records).filter((record) => record.matchMethod !== "none").length;
console.log(`Saved ${matched}/${papers.length} matched publication records to ${outputPath}`);
