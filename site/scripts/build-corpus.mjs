import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const outDir = path.join(siteRoot, "src", "data", "generated");

const TOOL_CANONICAL_NAMES = new Map([
  ["commit: digital pipette (v2)", "Commit: Digital Pipette"],
  ["low-cost near-field electrospinning machine", "Low-cost near-field electrospinning (NFES) system"],
  ["microextrusion bioprinter (recycled scrap material)", "Microextrusion bioprinter"],
  ["personal pipetting robot (phil)", "Personal Pipetting Robot"],
  ["the openflexure project", "OpenFlexure Microscope"],
  ["openflexure project", "OpenFlexure Microscope"],
  ["openflexure microscope", "OpenFlexure Microscope"]
]);

const TOOL_EXPLICIT_ALIASES = new Map([
  ["Commit: Digital Pipette", ["Commit: Digital Pipette (v2)"]],
  ["Low-cost near-field electrospinning (NFES) system", ["Low-cost near-field electrospinning machine", "NFES system"]],
  ["Microextrusion bioprinter", ["Microextrusion bioprinter (recycled scrap material)"]],
  ["Personal Pipetting Robot", ["Personal Pipetting Robot (PHIL)", "PHIL"]]
]);

const TOPIC_CANONICAL_NAMES = new Map([
  ["microfabrication/electrospinning (biofabrication)", "Electrospinning"],
  ["microfabrication/organ-on-chip", "Organ-on-chip"]
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [header, ...data] = rows;
  return data.map((cells) => {
    const record = {};
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]] = cells[i] ?? "";
    }
    return record;
  });
}

function readCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function readOptionalCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return readCsv(filePath);
}

function readOptionalJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function splitMulti(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "true", "1", "downloaded"].includes(normalized)) return true;
  if (["no", "false", "0", "not_available"].includes(normalized)) return false;
  if (normalized.includes("yes")) return true;
  if (normalized.includes("no")) return false;
  return null;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isPdfUrl(value) {
  const text = cleanText(value);
  if (!text) return false;
  try {
    const parsed = new URL(text);
    const pathName = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    return (
      pathName.endsWith(".pdf") ||
      pathName.includes("/pdf/") ||
      pathName.includes("/article-pdf/") ||
      pathName.includes("/article/file") ||
      pathName.includes("/download/") ||
      query.includes("type=printable")
    );
  } catch {
    return /\.pdf(\?|#|$)|\/pdf\/|\/article-pdf\/|\/article\/file|type=printable/i.test(text);
  }
}

function publicUrl(value) {
  const text = cleanText(value);
  return isPdfUrl(text) ? "" : text;
}

function sanitizePublicationForPublicSite(publication) {
  if (!publication) return null;
  const sanitized = structuredClone(publication);

  if (sanitized.openAlex?.openAccess) {
    sanitized.openAlex.openAccess.url = publicUrl(sanitized.openAlex.openAccess.url);
    sanitized.openAlex.openAccess.pdfUrl = "";
  }

  if (Array.isArray(sanitized.crossref?.fullTextLinks)) {
    sanitized.crossref.fullTextLinks = [];
  }

  if (Array.isArray(sanitized.openAlex?.locations)) {
    sanitized.openAlex.locations = sanitized.openAlex.locations.map((location) => ({
      ...location,
      pdfUrl: "",
      url: publicUrl(location?.url)
    }));
  }

  if (Array.isArray(sanitized.openAlex?.bestOpenAccessLocation)) {
    sanitized.openAlex.bestOpenAccessLocation = sanitized.openAlex.bestOpenAccessLocation.map((location) => ({
      ...location,
      pdfUrl: "",
      url: publicUrl(location?.url)
    }));
  } else if (sanitized.openAlex?.bestOpenAccessLocation) {
    sanitized.openAlex.bestOpenAccessLocation = {
      ...sanitized.openAlex.bestOpenAccessLocation,
      pdfUrl: "",
      url: publicUrl(sanitized.openAlex.bestOpenAccessLocation.url)
    };
  }

  return sanitized;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tokenize(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2);
}

function toTitleCase(value) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toDisplaySkillName(value) {
  const acronymish = new Set(["3d", "cad", "gui", "iso", "micropython"]);
  return cleanText(value)
    .split(/(\s+|\/|-)/)
    .map((part, index, parts) => {
      const lower = part.toLowerCase();
      if (!/[a-z0-9]/i.test(part)) return part;
      if (acronymish.has(lower)) {
        if (lower === "3d") return "3D";
        if (lower === "micropython") return "MicroPython";
        return lower.toUpperCase();
      }
      if (lower === "and" || lower === "or" || lower === "to" || lower === "on" || lower === "with" || lower === "of" || lower === "for") {
        const previous = parts.slice(0, index).join("").replace(/[\s/-]+$/g, "");
        return previous ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("")
    .replace(/\bArduino\b/gi, "Arduino")
    .replace(/\bG-Code\b/g, "G-code")
    .replace(/\bISO-Standard\b/g, "ISO-standard")
    .replace(/\(no /g, "(No ");
}

function extractRepoName(url, fallbackTitle) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "github.com" && parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }

    if (host.includes("mendeley.com") && parts.length >= 2) {
      return `Mendeley dataset ${parts[parts.length - 2]}`;
    }

    if (host === "hdl.handle.net") {
      return `Handle record ${parts.join("/")}`;
    }

    if (host === "doi.org") {
      return `DOI resource ${parts.join("/")}`;
    }

    if (parts.length > 0) {
      return toTitleCase(parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, ""));
    }

    return host;
  } catch {
    return fallbackTitle ? `${fallbackTitle} resource` : url;
  }
}

function repoKindFromUrl(url) {
  if (!url) return "resource";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "github.com") return "github";
    if (host.includes("mendeley.com")) return "dataset";
    if (host === "doi.org") return "doi";
    if (host === "hdl.handle.net") return "handle";
    return "website";
  } catch {
    return "resource";
  }
}

function splitLooseList(value) {
  return String(value || "")
    .split(/[|,]/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function normalizeCategoryLabel(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  const aliases = new Map([
    ["bioprinting", "Bioprinting"],
    ["liquid handling", "Liquid Handling"],
    ["microfluidics", "Microfluidics"],
    ["microfabrication", "Microfabrication"],
    ["electrospinning (biofabrication)", "Electrospinning"],
    ["custom printer", "Custom Printer"],
    ["organ-on-chip", "Organ-on-chip"],
    ["bioreactors", "Bioreactors & Cell Culture"],
    ["bioreactors & cell culture", "Bioreactors & Cell Culture"],
    ["microscopy", "Microscopy & Imaging"],
    ["microscopy & imaging", "Microscopy & Imaging"],
    ["prosthetics", "Prosthetics & Assistive Devices"],
    ["prosthetics & assistive devices", "Prosthetics & Assistive Devices"],
    ["laboratory automation", "Laboratory Automation"],
    ["open hardware methods", "Open Hardware Methods"]
  ]);
  return TOPIC_CANONICAL_NAMES.get(lower) || aliases.get(lower) || cleaned;
}

function normalizeDoi(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
}

function normalizeTitleKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitTaxonomy(value) {
  return unique(
    String(value || "")
      .split(/[|,]/)
      .map((part) => cleanText(part))
      .filter(Boolean)
  );
}

function inferSupplementalCategories(title) {
  const text = cleanText(title).toLowerCase();
  const categories = [];
  if (/bioprint|bioink|tissue fabrication|living material/.test(text)) categories.push("Bioprinting");
  if (/pipett|liquid handl|syringe pump|peristaltic|micropump|pressure pump|dosing|autosampler|fraction collector|fluid delivery/.test(text)) {
    categories.push("Liquid Handling");
  }
  if (/microfluid|lithograph|microfabricat|electrospin|electrowrit/.test(text)) categories.push("Microfabrication");
  if (/microscop|imaging|photomicroscope/.test(text)) categories.push("Microscopy & Imaging");
  if (/bioreactor|incubator|cell culture/.test(text)) categories.push("Bioreactors & Cell Culture");
  if (/prosthe|bionic hand|robot hand|myoelectric/.test(text)) categories.push("Prosthetics & Assistive Devices");
  if (/robot|automat|self-driving lab|laboratory robotics|pcr device/.test(text)) categories.push("Laboratory Automation");
  return unique(categories.length > 0 ? categories : ["Open Hardware Methods"]);
}

function inferModalities(title) {
  const text = cleanText(title).toLowerCase();
  return unique([
    /extrusion|direct ink writing/.test(text) ? "Extrusion" : "",
    /stereolith|\bdlp\b|photopolymer/.test(text) ? "Vat photopolymerization" : "",
    /pipett|liquid handl|dispens/.test(text) ? "Pipetting and dispensing" : "",
    /syringe pump|peristaltic|micropump|pressure pump/.test(text) ? "Pumping" : "",
    /microfluid/.test(text) ? "Microfluidics" : "",
    /electrospin|electrowrit/.test(text) ? "Electrospinning and electrowriting" : "",
    /microscop|imaging/.test(text) ? "Microscopy and imaging" : "",
    /robot|automat|self-driving/.test(text) ? "Robotics and automation" : "",
    /prosthe|bionic|myoelectric/.test(text) ? "Assistive devices" : "",
    /bioreactor|incubator|cell culture/.test(text) ? "Cell culture" : ""
  ]);
}

function inferNamedTool(title) {
  const cleaned = cleanText(title).replace(/^Commit:\s*/i, "");
  const colon = cleaned.match(/^([^:]{2,48}):\s+/);
  if (colon && colon[1].split(/\s+/).length <= 6 && !/^(design|development|system|implementation|principles|utility|democratizing|teach|building|adapting|automation|establishment)\b/i.test(colon[1])) {
    return colon[1];
  }

  const namedPatterns = [
    /^(OpenWorkstation|PyLabRobot|OpenLH|EvoBot|Metafluidics|Replistruder 4|mSLAb|micrIO|µPump)\b/i,
    /^(The FAST Pump|The Enderstruder|The incubot|The OpenFlexure Project)\b/i,
    /^(Digital pipette|OpenFlexure Microscope)\b/i
  ];
  for (const pattern of namedPatterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1];
  }
  if (/openflexure/i.test(cleaned)) return "OpenFlexure Microscope";
  if (/opentrons ot-2/i.test(cleaned)) return "Opentrons OT-2";
  if (/poseidon syringe pump/i.test(cleaned)) return "Poseidon syringe pump system";
  return "";
}

/** Jaccard overlap of the significant words in two strings, used to sanity-check filename matches. */
function titleOverlap(a, b) {
  const words = (value) => new Set(
    normalizeTitleKey(value).split(" ").filter((word) => word.length > 3)
  );
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function resolveManifestPdfPath(candidate, index, title = "") {
  const cleaned = cleanText(candidate);
  const fileName = cleaned ? path.basename(cleaned) : "";
  const candidates = unique([
    cleaned,
    fileName ? path.join(repoRoot, "downloaded_papers", fileName) : "",
    fileName ? path.join(repoRoot, "pdfs", fileName) : ""
  ]);
  for (const filePath of candidates) {
    if (filePath && fs.existsSync(filePath)) return filePath;
  }

  // Index-prefix fallback. The download manifest and the assessment workbook number papers
  // independently, so the same prefix can point at two different papers — require the filename's
  // title portion to actually match before trusting it.
  if (index) {
    const prefix = `${String(index).padStart(3, "0")}_`;
    for (const directory of [path.join(repoRoot, "pdfs"), path.join(repoRoot, "downloaded_papers")]) {
      if (!fs.existsSync(directory)) continue;
      const match = fs.readdirSync(directory).find((name) => {
        if (!name.startsWith(prefix) || !name.toLowerCase().endsWith(".pdf")) return false;
        if (!title) return true;
        const fromFile = name.slice(prefix.length, -4).replace(/_/g, " ");
        return titleOverlap(fromFile, title) >= 0.5;
      });
      if (match) return path.join(directory, match);
    }
  }
  return "";
}

function isToolLikeName(name) {
  const cleaned = cleanText(name);
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  const banned = new Set(["e.g.", "modular", "protocol/paper", "preprint"]);
  if (banned.has(lower)) return false;
  if (cleaned.length > 90) return false;
  if (cleaned.split(/\s+/).length > 10) return false;
  return /[A-Z]/.test(cleaned) || /\d/.test(cleaned) || cleaned.includes("(") || cleaned.includes("-");
}

function normalizeToolName(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  return TOOL_CANONICAL_NAMES.get(cleaned.toLowerCase()) || cleaned;
}

function inferSkillLevel(skills, buildComplexity, easyToBuild, easyToUse) {
  const joined = `${skills.join(" ")} ${buildComplexity}`.toLowerCase();
  if (
    /robot|electronics|firmware|microcontroller|programming|cv|computer vision|laser|stereolithography|microfluidic|organic chemistry/.test(joined)
  ) {
    return "high";
  }
  if (/cad|3d print|assembly|solder|mechanical|fabrication|marlin/.test(joined)) {
    return "medium";
  }
  if (easyToBuild === true && easyToUse === true) return "low";
  if (skills.length <= 1 && !joined) return "low";
  return "medium";
}

function inferEngineeringBarrier(skillLevel, buildComplexity, lowCost, easyToBuild) {
  const joined = String(buildComplexity || "").toLowerCase();
  if (skillLevel === "high" || /advanced|high|complex|multi-step|specialized/.test(joined)) return "high";
  if (skillLevel === "low" && (lowCost === true || easyToBuild === true)) return "low";
  return "medium";
}

function documentationScoreForPaper(paper) {
  let score = 0;
  if (paper.primaryLink) score += 1;
  if (paper.repo) score += 1;
  if (paper.pdf.localPath) score += 1;
  if (paper.pageIndex.available) score += 1;
  if (paper.openSourceResources || paper.keySources) score += 1;
  return score;
}

function documentationTierForScore(score) {
  if (score >= 4) return "strong";
  if (score >= 2) return "moderate";
  return "limited";
}

const ASSET_PATTERNS = [
  { type: "cad", format: "CAD", pattern: /\bcad\b|stl|step|fusion ?360|solidworks|design files?/i },
  { type: "bom", format: "BOM", pattern: /\bbom\b|bill of materials/i },
  { type: "protocol", format: "Protocol", pattern: /protocol|build guide|assembly instructions?|jove/i },
  { type: "pcb", format: "PCB", pattern: /\bpcb\b|gerber|board files?/i },
  { type: "firmware", format: "Firmware", pattern: /firmware|marlin|g-code/i },
  { type: "schematics", format: "Schematics", pattern: /schematic|wiring diagram/i },
  { type: "software", format: "Software", pattern: /software|gui|python scripts?|code/i },
  { type: "documentation", format: "Documentation", pattern: /documentation|manual|instructions?/i }
];

function findUrls(value) {
  return String(value || "").match(/https?:\/\/[^\s|)]+/g) || [];
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function pickBestAssetUrl(paper, signalType) {
  const candidates = [
    ...findUrls(paper.openSourceResources),
    ...findUrls(paper.keySources),
    paper.repo?.url || "",
    paper.primaryLink || ""
  ].filter((value) => value && isLikelyUrl(value));

  const scored = candidates.map((url) => {
    let score = 0;
    if (/github\.com|osf\.io|openliquidhandler\.com|printess/i.test(url)) score += 4;
    if (signalType === "cad" && /github|osf|cad|stl|step|design/i.test(url)) score += 2;
    if (signalType === "protocol" && /jove|protocol|methods|guide|instructions/i.test(url)) score += 2;
    if (signalType === "software" && /github|software|code/i.test(url)) score += 2;
    if (/pdf|epdf/.test(url)) score -= 1;
    return { url, score };
  });

  scored.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return scored[0]?.url || "";
}

function extractAssetSignals(paper) {
  const evidenceText = [
    paper.openSourceResources,
    paper.keySources,
    paper.function,
    paper.whyItMatters,
    paper.repo?.url || "",
    paper.primaryLink
  ]
    .filter(Boolean)
    .join(" | ");
  return ASSET_PATTERNS.filter((item) => item.pattern.test(evidenceText)).map((item) => ({
    type: item.type,
    format: item.format,
    evidence: evidenceText,
    url: pickBestAssetUrl(paper, item.type)
  }));
}

function inferEventType(venue, type, primaryLink) {
  const text = `${venue} ${type} ${primaryLink}`.toLowerCase();
  if (
    /journal|transactions|nature|frontiers|materials|bioengineering|biotechnology|synthetic biology|hardwarex|advanced materials|digital discovery|scientific reports|mdpi/.test(text)
    && !/\bconference\b|\bworkshop\b|\bsymposium\b|\bproceedings\b|\bchi\b|\bicmd\b/.test(text)
  ) {
    return "";
  }
  if (/workshop/.test(text)) return "workshop";
  if (/\bconference\b|\bproceedings\b|\bsymposium\b|\bchi\b|\bicmd\b/.test(text)) return "conference";
  if (/demo/.test(text)) return "demo";
  return "";
}

function replicationStatusForTool(tool) {
  if (tool.workshopPaperCount > 0) return "workshop-ready candidate";
  if (tool.documentationScore >= 4) return "well-documented";
  if (tool.repoCount > 0 || tool.paperCount > 1) return "partially documented";
  return "paper-linked only";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pageSpanLabel(startIndex, endIndex) {
  if (!Number.isFinite(startIndex) && !Number.isFinite(endIndex)) return "pages unknown";
  if (startIndex === endIndex) return `p. ${startIndex}`;
  return `pp. ${startIndex}-${endIndex}`;
}

const SEMANTIC_SIGNAL_PATTERNS = [
  { tag: "methods", pattern: /\bmethods?\b|\bprotocol\b|\bprocedure\b/i },
  { tag: "assembly", pattern: /\bassembly\b|\bbuild\b|\bconstruction\b|\bframe\b/i },
  { tag: "calibration", pattern: /\bcalibration\b|\bvalidation\b|\bbenchmark\b|\btesting\b/i },
  { tag: "cad", pattern: /\bcad\b|stl|step|solidworks|fusion/i },
  { tag: "bom", pattern: /\bbom\b|bill of materials/i },
  { tag: "firmware", pattern: /\bfirmware\b|marlin|g-code/i },
  { tag: "software", pattern: /\bsoftware\b|\bgui\b|\bpython\b|\bcode\b/i },
  { tag: "wiring", pattern: /\bwiring\b|\belectrical\b|\bschematics?\b|\bpcb\b/i },
  { tag: "results", pattern: /\bresults?\b|\bperformance\b|\baccuracy\b/i },
  { tag: "discussion", pattern: /\bdiscussion\b|\bconclusion\b|\boutlook\b/i }
];

function inferSemanticSignals(value) {
  const text = cleanText(value);
  return SEMANTIC_SIGNAL_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.tag);
}

function buildChunkSearchText(paper, title, summary, semanticSignals) {
  return unique([
    paper.title,
    title,
    summary,
    paper.summary,
    paper.whyItMatters,
    paper.category.join(" "),
    paper.modality.join(" "),
    paper.toolNames.join(" "),
    paper.topicNames.join(" "),
    paper.assetTypes.join(" "),
    paper.eventNames.join(" "),
    paper.repo?.name || "",
    semanticSignals.join(" "),
    paper.technicalSkillsNeeded.join(" ")
  ]).join(" ");
}

const curatedPapersCsv = readCsv(path.join(repoRoot, "lists", "derived", "unified_papers.csv"));
const downloadManifest = readOptionalCsv(path.join(repoRoot, "downloaded_papers", "download_manifest.csv"));
const pdfManifest = readCsv(path.join(repoRoot, "pdfs", "pdf_manifest.csv"));
const pageIndexManifest = readCsv(path.join(repoRoot, "pageindex", "pageindex_manifest.csv"));
const curatedManifest = readOptionalCsv(path.join(repoRoot, "lists", "curated", "asset_event_manifest.csv"));
const criteriaRubricCsv = readOptionalCsv(path.join(repoRoot, "lists", "curated", "criteria_rubric.csv"));
const criteriaAssessmentCsv = readOptionalCsv(
  path.join(repoRoot, "lists", "derived", "biofabrication_pdf_criteria_assessment.csv")
);
const publicationMetadataCache = readOptionalJson(
  path.join(siteRoot, "src", "data", "enrichment", "publication_metadata.json"),
  { records: {} }
);
const fulltextExtractionCsv = readOptionalCsv(
  path.join(repoRoot, "lists", "derived", "fulltext_extraction.csv")
);

/**
 * Licence for the *artifact*, not the article. A publisher's CC-BY covers the paper;
 * it says nothing about whether the design files can be reused. Prefer what the host
 * reports (an SPDX id from the repo), then a licence stated in the paper's own
 * specifications table, then prose scoped to the artifact. Article-scoped matches are
 * deliberately ignored.
 */
const fulltextByTitle = new Map(
  fulltextExtractionCsv.map((row) => [normalizeTitleKey(row.title_from_filename), row])
);

/**
 * Repository links come from two places with different strength: the curated
 * repo_oshw_link, which we resolve and check for reachability, and links mined from the
 * paper's own text, which are unverified. Showing the second as "no link" would be
 * wrong -- the paper does publish a location, we simply have not confirmed it.
 */
/**
 * Repository links mined from a paper's full text and then actually fetched.
 *
 * These sat in textRepoLinks for months labelled "unverified", which read as though they
 * had failed a check. They had never been checked. All twelve resolve, so they are
 * repository links like any other -- the difference is only how they were found, which
 * `provenance` records. The mined list also carries dependencies a paper happens to cite
 * (pytest, mypy, pylint) and bare organisation pages; this file names one canonical link
 * per record, chosen by hand.
 */
const verifiedTextRepoCsv = readOptionalCsv(
  path.join(repoRoot, "lists", "curated", "verified_text_repo_links.csv")
);
const verifiedTextRepoByTitle = new Map(
  verifiedTextRepoCsv.map((row) => [normalizeTitleKey(row.paper_title), row])
);

function textRepoLinksFor(title) {
  const row = fulltextByTitle.get(normalizeTitleKey(title));
  return splitMulti(row?.repo_links || "").filter(Boolean);
}

/**
 * Design-file licences a curator has read off the paper and recorded by hand, for records
 * the automatic extraction never reached: fulltext_extraction.csv holds 46 of the 60
 * papers, so a licence printed plainly in a paper's specifications table could still be
 * missing from the corpus. The Enderstruder was the first case found. Ranks below what the
 * repository host reports and above the automatic extraction.
 */
const curatedLicenceCsv = readOptionalCsv(path.join(repoRoot, "lists", "curated", "artifact_licences.csv"));
const curatedLicenceByTitle = new Map(
  curatedLicenceCsv.map((row) => [normalizeTitleKey(row.paper_title), row])
);

/**
 * Build costs a curator has read off the paper. With precedence "fallback" (the default) a
 * row fills a cost the workbook and criteria sheet both leave blank; with "override" it
 * replaces their figure, for the case where the paper's own bill of materials says otherwise.
 */
const curatedCostCsv = readOptionalCsv(path.join(repoRoot, "lists", "curated", "build_costs.csv"));
const curatedCostByTitle = new Map(
  curatedCostCsv.map((row) => [normalizeTitleKey(row.paper_title), row])
);

function artifactLicenceFor(title, repoAccessibility) {
  const hostLicence = cleanText(repoAccessibility?.license);
  if (hostLicence) return { value: hostLicence, source: "repository host", scope: "artifact" };

  const curated = curatedLicenceByTitle.get(normalizeTitleKey(title));
  if (curated && cleanText(curated.licence) && cleanText(curated.scope).startsWith("artifact")) {
    return { value: cleanText(curated.licence), source: cleanText(curated.source) || "curated", scope: "artifact" };
  }

  const row = fulltextByTitle.get(normalizeTitleKey(title));
  const scope = cleanText(row?.licence_scope);
  const value = cleanText(row?.licence);
  if (value && scope.startsWith("artifact")) {
    return {
      value,
      source: scope.includes("spec table") ? "specifications table" : "paper text",
      scope: "artifact"
    };
  }
  return { value: "", source: "", scope: "" };
}

const reportedMetricsCsv = readOptionalCsv(
  path.join(repoRoot, "lists", "derived", "reported_metrics.csv")
);

/**
 * Per-paper record of which performance requirements the source actually reports a
 * number for. "no" means we read the full text and found none; "na" means we do not
 * hold the full text, so the question is unanswered rather than answered negatively.
 */
const REPORTED_METRIC_FIELDS = [
  ["motion_accuracy", "Motion / positional accuracy"],
  ["volumetric_accuracy", "Volumetric accuracy"],
  ["cell_viability", "Cell viability"],
  ["unattended_operation", "Unattended operation"],
  ["standard_compliance", "Reported against a written standard"]
];

const reportedMetricsByTitle = new Map(
  reportedMetricsCsv.map((row) => [normalizeTitleKey(row.title), row])
);
const reportedMetricsByDoi = new Map(
  reportedMetricsCsv.filter((row) => normalizeDoi(row.doi)).map((row) => [normalizeDoi(row.doi), row])
);

/**
 * Reported-metric corrections a curator has made against the paper, for the cases where the
 * regex extraction took the wrong number (an ink concentration, a serum percentage, a
 * standard deviation). One row per metric; it replaces that metric's status, value and
 * evidence and leaves the other four as extracted.
 */
const metricOverridesCsv = readOptionalCsv(path.join(repoRoot, "lists", "curated", "reported_metrics_overrides.csv"));
const metricOverridesByTitle = new Map();
for (const row of metricOverridesCsv) {
  const key = normalizeTitleKey(row.paper_title);
  if (!metricOverridesByTitle.has(key)) metricOverridesByTitle.set(key, new Map());
  metricOverridesByTitle.get(key).set(cleanText(row.metric), row);
}

/**
 * Units as the site's font can set them. D-DIN carries the micro sign (U+00B5) but not the
 * Greek mu (U+03BC), so a "μm" copied from a PDF fell back to a heavier system glyph and
 * looked bold; curators also typed "100 um". Both become "100 µm".
 */
function normaliseUnits(text) {
  return String(text || "")
    .replace(/\u03bc/g, "\u00b5")
    .replace(/(\d)\s*um\b/g, "$1 \u00b5m")
    .replace(/\bum\b(?=\s*(?:resolution|feature|line|filament|position|accuracy|pixel|channel|layer)|[.,;)])/g, "\u00b5m");
}

function reportedMetricsFor(title, doi) {
  const row = reportedMetricsByDoi.get(normalizeDoi(doi)) || reportedMetricsByTitle.get(normalizeTitleKey(title));
  if (!row) {
    return { assessed: false, fullTextRead: false, reportedCount: 0, metrics: [] };
  }
  const overrides = metricOverridesByTitle.get(normalizeTitleKey(title)) || new Map();
  const metrics = REPORTED_METRIC_FIELDS.map(([key, label]) => {
    const fix = overrides.get(key);
    return {
      id: key.replace(/_/g, "-"),
      label,
      status: fix ? cleanText(fix.status) : cleanText(row[key]) || "na",
      value: normaliseUnits(fix ? cleanText(fix.value) : cleanText(row[`${key}_value`])),
      evidence: normaliseUnits(fix ? `[curated] ${cleanText(fix.evidence)}` : cleanText(row[`${key}_evidence`]))
    };
  });
  return {
    assessed: true,
    fullTextRead: cleanText(row.has_fulltext) === "yes",
    reportedCount: metrics.filter((m) => m.status === "yes").length,
    metrics
  };
}

const repoAccessibilityCache = readOptionalJson(
  path.join(siteRoot, "src", "data", "enrichment", "repo_accessibility.json"),
  { records: {} }
);

/** Accessibility check for a repo/design-file URL: reachability, last activity, and when we looked. */
function repoAccessibilityFor(url) {
  const record = repoAccessibilityCache.records?.[cleanText(url)];
  if (!record) {
    return { checked: false, accessible: null, lastActivity: "", lastActivitySource: "", archived: false, checkedAt: "" };
  }
  const lastActivity = cleanText(record.lastActivity);
  // Age of the most recent upstream activity, used to describe maintenance. Hosts that
  // do not expose commit history (OSF, Zenodo, project sites) report no date at all,
  // which is "unknown" rather than "stale" -- the deposit may be complete by design.
  let ageDays = null;
  if (lastActivity) {
    const then = Date.parse(lastActivity);
    if (Number.isFinite(then)) ageDays = Math.floor((Date.now() - then) / 86400000);
  }
  let maintenance = "unknown";
  if (ageDays !== null) {
    if (ageDays <= 365) maintenance = "active";
    else if (ageDays <= 365 * 3) maintenance = "aging";
    else maintenance = "stale";
  }

  return {
    checked: true,
    accessible: Boolean(record.accessible),
    httpStatus: record.httpStatus ?? null,
    lastActivity,
    lastActivitySource: cleanText(record.lastActivitySource),
    ageDays,
    ageLabel: ageDays === null
      ? "not reported by host"
      : ageDays < 60
        ? `${ageDays} days ago`
        : ageDays < 730
          ? `${Math.round(ageDays / 30)} months ago`
          : `${(ageDays / 365).toFixed(1)} years ago`,
    maintenance,
    archived: Boolean(record.archived),
    license: cleanText(record.license),
    checkedAt: cleanText(record.checkedAt)
  };
}

const criteriaRubricByCriterion = new Map();
for (const row of criteriaRubricCsv) {
  const name = cleanText(row.criterion);
  if (!name) continue;

  if (!criteriaRubricByCriterion.has(name)) {
    criteriaRubricByCriterion.set(name, {
      id: slugify(name),
      name,
      description: cleanText(row.description),
      technologies: []
    });
  }

  criteriaRubricByCriterion.get(name).technologies.push({
    type: cleanText(row.technology_type),
    informationToExtract: cleanText(row.information_to_extract),
    scores: [1, 2, 3, 4, 5].map((score) => ({
      value: score,
      anchor: normaliseUnits(cleanText(row[`score_${score}`]))
    }))
  });
}

const criteriaRubric = [...criteriaRubricByCriterion.values()];

// The assessment workbook's column headers carry a typo ("Cosumable") and run long enough
// to be unreadable as table headings. Corrected and shortened for display only -- the CSVs
// keep the original spelling so they still match the source workbook.
const CRITERION_DISPLAY = {
  "Equipment/Cosumable/Facility Requirement Accessibility": {
    name: "Equipment/consumable/facility accessibility",
    short: "Facilities needed"
  },
  "Build and Part Sourcing Complexity": { short: "Parts sourcing" },
  "Validation/Troubleshooting Complexity": { short: "Validation effort" },
  "Accessibility to documentation": { short: "Documentation" },
  "Scalability/Throughput": { short: "Throughput" },
  "Skill Complexity": { short: "Skill needed" },
  "Speed/Cycle Time": { short: "Cycle time" },
  "Resolution": { short: "Resolution" }
};

function criterionLabels(name) {
  const override = CRITERION_DISPLAY[name] || {};
  return { displayName: override.name || name, shortName: override.short || override.name || name };
}

const criteriaNames = criteriaAssessmentCsv.length > 0
  ? Object.keys(criteriaAssessmentCsv[0])
      .filter((key) => key.endsWith(" value"))
      .map((key) => key.slice(0, -" value".length))
  : [];
const criteriaByTitle = new Map(
  criteriaAssessmentCsv.map((row) => [normalizeTitleKey(row.title), row])
);
const criteriaByDoi = new Map(
  criteriaAssessmentCsv
    .filter((row) => normalizeDoi(row.doi))
    .map((row) => [normalizeDoi(row.doi), row])
);

function criteriaAssessmentForPaper(title, doi) {
  const row = criteriaByDoi.get(normalizeDoi(doi)) || criteriaByTitle.get(normalizeTitleKey(title));
  if (!row) {
    return {
      assessed: false,
      rubricMapped: false,
      technologyType: "",
      averageScore: null,
      scoredCriteriaCount: 0,
      criteria: []
    };
  }

  const criteria = criteriaNames.map((name) => {
    const rawValue = cleanText(row[`${name} value`]);
    const numericValue = Number.parseInt(rawValue, 10);
    const { displayName, shortName } = criterionLabels(name);
    return {
      id: slugify(name),
      name: displayName,
      shortName,
      value: Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 5 ? numericValue : null,
      rationale: normaliseUnits(cleanText(row[`${name} rationale`]))
    };
  });
  const values = criteria.map((criterion) => criterion.value).filter(Number.isFinite);

  // The assessment workbook also records a build cost that the curated workbooks often lack.
  const assessedCost = cleanText(row["Approximate Total Build Cost (USD)"]);

  return {
    assessed: true,
    rubricMapped: values.length > 0,
    technologyType: cleanText(row.technology_type),
    approximateBuildCost: /^(n\/?a|none|unknown|not reported)$/i.test(assessedCost) ? "" : assessedCost,
    averageScore: values.length > 0
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null,
    scoredCriteriaCount: values.length,
    criteria
  };
}

ensureDir(outDir);

const downloadByTitle = new Map(downloadManifest.map((row) => [normalizeTitleKey(row.title), row]));
const downloadByDoi = new Map(
  downloadManifest
    .filter((row) => normalizeDoi(row.doi))
    .map((row) => [normalizeDoi(row.doi), row])
);
const curatedTitleKeys = new Set(curatedPapersCsv.map((row) => normalizeTitleKey(row.paper_title)));
const curatedDois = new Set(curatedPapersCsv.map((row) => normalizeDoi(row.doi)).filter(Boolean));

const supplementalPapersCsv = downloadManifest
  .filter((row) => {
    const titleKey = normalizeTitleKey(row.title);
    const doiKey = normalizeDoi(row.doi);
    return !curatedTitleKeys.has(titleKey) && !(doiKey && curatedDois.has(doiKey));
  })
  .map((row) => {
    const rawTitle = cleanText(row.title);
    const title = /^https?:\/\//i.test(rawTitle)
      ? `Unresolved HardwareX record (${rawTitle.match(/S\d[\d()-]+/i)?.[0] || "URL-only source"})`
      : rawTitle.replace(/&amp;/g, "&");
    const categories = inferSupplementalCategories(title);
    return {
      paper_title: title,
      doi: cleanText(row.doi),
      primary_link: row.doi ? `https://doi.org/${normalizeDoi(row.doi)}` : cleanText(row.url),
      year: "",
      category: categories.join(" | "),
      subcategory: "",
      modality: inferModalities(title).join(" | "),
      system_or_technology: inferNamedTool(title),
      type: "Supplemental corpus record",
      venue: "",
      inclusion_fit: "Supplemental paper list",
      key_sources: cleanText(row.source),
      repo_oshw_link: "",
      what_is_open_sourced: "",
      why_it_matters: "Supplemental record retained to make the downloaded paper corpus fully navigable.",
      approximate_cost_or_cost_usd: "",
      low_cost: "",
      easy_to_build: "",
      easy_to_use: "",
      open_source: "",
      key_democratizing_feature: "",
      motivation_use_case: "",
      limitation: "Metadata is limited to the download manifest and title-derived mapping.",
      function: "",
      build_complexity: "",
      technical_skills_needed: "",
      open_source_resources: "",
      source_workbooks: "download_manifest",
      _scope: "supplemental",
      _mappingConfidence: categories[0] === "Open Hardware Methods" ? "low" : "medium",
      _downloadRow: row
    };
  });

/**
 * Canonical DOI for a corpus row.
 *
 * The source workbooks record the same work two ways: tool-centric rows carry a tool name plus a
 * publisher URL (no DOI), while paper-centric rows carry the paper title plus a DOI. Resolving both
 * to a DOI — from the doi column, from a DOI embedded in the link, or from the publication-metadata
 * cache keyed by title — is what lets the two collapse into one record instead of two.
 */
// The publication cache is keyed by normalised title, which is fragile: correcting a
// mis-transcribed title in the source workbook silently orphans its cached record, and the
// paper then looks as though no index carries it. That is exactly what happened to the Nydus
// One extruder, whose title we fixed from the workbook's wrong version. Build a DOI index
// alongside the title one and try the DOI first, since the DOI is the stable identifier.
const publicationByDoi = new Map();
for (const record of Object.values(publicationMetadataCache.records ?? {})) {
  const doi = normalizeDoi(record?.resolvedDoi || record?.requestedDoi);
  // Only a confirmed DOI match; a fuzzy title hit must not claim a DOI it never verified.
  if (doi && record?.matchMethod === "doi" && !publicationByDoi.has(doi)) {
    publicationByDoi.set(doi, record);
  }
}

function publicationRecordFor(title, doi) {
  return (
    publicationByDoi.get(normalizeDoi(doi)) ||
    publicationMetadataCache.records?.[normalizeTitleKey(title)] ||
    null
  );
}

function canonicalDoi(row) {
  const direct = normalizeDoi(row.doi || row.paper_doi);
  if (direct) return direct;

  const fromLink = cleanText(row.primary_link).match(/10\.\d{4,9}\/[^\s"<>]+/i)?.[0];
  if (fromLink) return normalizeDoi(fromLink.replace(/[.,;)]+$/, ""));

  const cached = publicationMetadataCache.records?.[normalizeTitleKey(row.paper_title)];
  const resolved = normalizeDoi(cached?.resolvedDoi);
  // Only trust the cache when it confirmed the DOI rather than guessing from a fuzzy title match.
  if (resolved && cached?.matchMethod === "doi") return resolved;
  return "";
}

/** Merge a duplicate row into the record we are keeping, preferring existing values and unioning lists. */
function mergeDuplicateRow(target, extra) {
  const unionFields = new Set([
    "category", "modality", "limitation", "open_source_resources",
    "source_workbooks", "source_rows", "source_paths"
  ]);
  for (const [key, rawValue] of Object.entries(extra)) {
    if (key.startsWith("_")) continue;
    const value = cleanText(rawValue);
    if (!value) continue;
    const current = cleanText(target[key]);
    if (!current) {
      target[key] = value;
    } else if (unionFields.has(key) && current !== value) {
      const seen = new Set(current.split(" | ").map((part) => part.trim().toLowerCase()));
      const additions = value.split(" | ").map((part) => part.trim()).filter((part) => part && !seen.has(part.toLowerCase()));
      if (additions.length) target[key] = [current, ...additions].join(" | ");
    }
  }
  if (!cleanText(target.system_or_technology) && cleanText(extra.paper_title) !== cleanText(target.paper_title)) {
    target.system_or_technology = cleanText(extra.paper_title);
  }
  return target;
}

/** Collapse curated rows that resolve to the same DOI (tool-name row + paper-title row for one work). */
function dedupeByCanonicalDoi(rows) {
  const byDoi = new Map();
  const output = [];
  for (const row of rows) {
    const doi = canonicalDoi(row);
    if (!doi) {
      output.push(row);
      continue;
    }
    const existing = byDoi.get(doi);
    if (!existing) {
      byDoi.set(doi, row);
      output.push(row);
      continue;
    }
    console.warn(`[corpus] collapsed duplicate for ${doi}: "${cleanText(row.paper_title)}" into "${cleanText(existing.paper_title)}"`);
    mergeDuplicateRow(existing, row);
  }
  return output;
}

const papersCsv = [
  ...dedupeByCanonicalDoi(curatedPapersCsv).map((row) => ({ ...row, _scope: "curated", _mappingConfidence: "high" })),
  ...supplementalPapersCsv
];

const pdfByTitle = new Map(
  pdfManifest.map((row) => [
    cleanText(row.paper_title).toLowerCase(),
    {
      pdfAvailableAny: normalizeBoolean(row.pdf_available_any),
      selectedPdfSource: cleanText(row.selected_pdf_source),
      selectedPdfUrl: cleanText(row.selected_pdf_url),
      downloadStatus: cleanText(row.download_status),
      localPdfPath: cleanText(row.local_pdf_path)
    }
  ])
);

const pageIndexByTitle = new Map(
  pageIndexManifest.map((row) => [
    cleanText(row.paper_title).toLowerCase(),
    {
      status: cleanText(row.status),
      outputJson: cleanText(row.output_json)
    }
  ])
);

const papers = papersCsv.map((row, index) => {
  const title = cleanText(row.paper_title);
  const key = title.toLowerCase();
  const pdf = pdfByTitle.get(key) || {};
  const downloadRow = row._downloadRow || downloadByDoi.get(normalizeDoi(row.doi)) || downloadByTitle.get(normalizeTitleKey(title));
  const pageIndex = pageIndexByTitle.get(key) || {};
  const category = unique(splitMulti(row.category).map(normalizeCategoryLabel));
  const modality = splitTaxonomy(row.modality);
  const sourceWorkbooks = splitMulti(row.source_workbooks);
  const pdfManifestPath = pdf.localPdfPath
    ? (path.isAbsolute(pdf.localPdfPath) ? pdf.localPdfPath : path.join(repoRoot, pdf.localPdfPath))
    : "";
  const manifestPdfPath = downloadRow?.status === "downloaded"
    ? resolveManifestPdfPath(downloadRow.file, downloadRow.index, title)
    : "";
  const sourcePdfPath = (pdfManifestPath && fs.existsSync(pdfManifestPath) ? pdfManifestPath : "") || manifestPdfPath || "";
  const localPdfPath = "";
  const pageIndexPath = pageIndex.outputJson || "";
  const year = Number.parseInt(String(row.year || "").trim(), 10);
  // A curated link wins; a verified in-text link is the fallback, so the site stops saying
  // "unverified" about a URL that answers 200.
  const verifiedTextRepo = verifiedTextRepoByTitle.get(normalizeTitleKey(title));
  const curatedCost = curatedCostByTitle.get(normalizeTitleKey(title));
  // A curated cost normally fills a blank; marked "override" it replaces a table figure the
  // curator has checked against the paper's own bill of materials and found wrong.
  const curatedCostWins = Boolean(cleanText(curatedCost?.cost)) && cleanText(curatedCost?.precedence).toLowerCase() === "override";
  const repoUrl = cleanText(row.repo_oshw_link) || cleanText(verifiedTextRepo?.verified_url);
  const repoProvenance = cleanText(row.repo_oshw_link)
    ? "curated"
    : verifiedTextRepo
      ? "full text, verified"
      : "";
  const democratizingFeatures = splitMulti(
    String(row.key_democratizing_feature || "").replace(/;/g, "|")
  );
  const skills = splitMulti(
    String(row.technical_skills_needed || "").replace(/;/g, "|")
  );
  const repoName = extractRepoName(repoUrl, title);
  const repoSlug = repoUrl ? slugify(repoName || repoUrl) : "";
  const criteriaAssessment = criteriaAssessmentForPaper(title, row.doi);
  const publication = sanitizePublicationForPublicSite(publicationRecordFor(title, row.doi));

  return {
    id: `paper-${String(index + 1).padStart(3, "0")}`,
    slug: `${String(index + 1).padStart(3, "0")}-${slugify(title)}`,
    title,
    doi: cleanText(row.doi),
    publication,
    primaryLink: publicUrl(row.primary_link),
    year: Number.isFinite(year) ? year : null,
    venue: cleanText(row.venue),
    type: cleanText(row.type),
    category,
    modality,
    systemOrTechnology: cleanText(row.system_or_technology),
    inclusionFit: cleanText(row.inclusion_fit),
    summary: cleanText(row.why_it_matters || row.motivation_use_case),
    whyItMatters: cleanText(row.why_it_matters),
    motivationUseCase: cleanText(row.motivation_use_case),
    limitation: cleanText(row.limitation),
    function: cleanText(row.function),
    keySources: cleanText(row.key_sources),
    openSourceResources: cleanText(row.open_source_resources),
    sourceWorkbooks,
    sourceScope: row._scope || "curated",
    mappingConfidence: row._mappingConfidence || "high",
    buildComplexity: cleanText(row.build_complexity),
    technicalSkillsNeeded: skills,
    // Prefer the curated workbook's cost; fall back to the criteria assessment, which records one
    // for many papers the workbooks left blank.
    approximateCost: curatedCostWins
      ? cleanText(curatedCost.cost)
      : cleanText(row.approximate_cost_or_cost_usd) || criteriaAssessment.approximateBuildCost || cleanText(curatedCost?.cost) || "",
    approximateCostSource: curatedCostWins || (!cleanText(row.approximate_cost_or_cost_usd) && !criteriaAssessment.approximateBuildCost && cleanText(curatedCost?.cost))
      ? `curated: ${cleanText(curatedCost.source) || "paper"}`
      : cleanText(row.approximate_cost_or_cost_usd)
      ? "curated workbook"
      : (criteriaAssessment.approximateBuildCost ? "criteria assessment" : ""),
    openSource: normalizeBoolean(row.open_source),
    lowCost: normalizeBoolean(row.low_cost),
    easyToBuild: normalizeBoolean(row.easy_to_build),
    easyToUse: normalizeBoolean(row.easy_to_use),
    repo: repoUrl
      ? {
          id: `repo-${repoSlug}`,
          slug: repoSlug,
          name: repoName,
          url: repoUrl,
          kind: repoKindFromUrl(repoUrl),
          provenance: repoProvenance,
          accessibility: repoAccessibilityFor(repoUrl)
        }
      : null,
    pdf: {
      available: false,
      localPath: localPdfPath,
      publicPath: "",
      sourceUrl: "",
      status: sourcePdfPath ? "not published" : ""
    },
    pageIndex: {
      available: false,
      status: "",
      outputPath: "",
      publicPath: ""
    },
    tags: unique([
      ...category,
      ...modality,
      cleanText(row.subcategory),
      cleanText(row.type),
      cleanText(row.system_or_technology)
    ]),
    democratizingFeatures: unique(democratizingFeatures),
    evidenceSources: unique([
      publicUrl(row.primary_link),
      cleanText(row.repo_oshw_link),
      publicUrl(downloadRow?.url)
    ]),
    assetIds: [],
    assetSlugs: [],
    assetTypes: [],
    eventIds: [],
    eventSlugs: [],
    eventNames: [],
    criteriaAssessment,
    reportedMetrics: reportedMetricsFor(title, row.doi),
    artifactLicence: artifactLicenceFor(title, repoUrl ? repoAccessibilityFor(repoUrl) : null),
    textRepoLinks: textRepoLinksFor(title).filter((link) => link !== repoUrl),
    derived: {
      skillLevel: "medium",
      engineeringBarrier: "medium",
      documentationScore: 0,
      documentationTier: "limited",
      workshopReady: false,
      evidenceRich: false
    }
  };
});

for (const paper of papers) {
  const skillLevel = inferSkillLevel(
    paper.technicalSkillsNeeded,
    paper.buildComplexity,
    paper.easyToBuild,
    paper.easyToUse
  );
  const engineeringBarrier = inferEngineeringBarrier(
    skillLevel,
    paper.buildComplexity,
    paper.lowCost,
    paper.easyToBuild
  );
  const documentationScore = documentationScoreForPaper(paper);
  const documentationTier = documentationTierForScore(documentationScore);
  const workshopReady =
    paper.openSource !== false &&
    paper.pdf.localPath &&
    (paper.repo || paper.pageIndex.available) &&
    skillLevel !== "high" &&
    engineeringBarrier !== "high" &&
    (paper.lowCost !== false || paper.easyToBuild === true || paper.easyToUse === true);

  paper.derived = {
    skillLevel,
    engineeringBarrier,
    documentationScore,
    documentationTier,
    workshopReady,
    evidenceRich: Boolean(paper.pdf.localPath && paper.repo && paper.pageIndex.available)
  };
}

const repoMap = new Map();

for (const paper of papers) {
  if (!paper.repo) continue;
  const existing = repoMap.get(paper.repo.url);
  if (existing) {
    existing.paperIds.push(paper.id);
    existing.paperSlugs.push(paper.slug);
    existing.paperTitles.push(paper.title);
    existing.categories.push(...paper.category);
    existing.modalities.push(...paper.modality);
    continue;
  }

  repoMap.set(paper.repo.url, {
    id: paper.repo.id,
    slug: paper.repo.slug,
    name: paper.repo.name,
    url: paper.repo.url,
    kind: paper.repo.kind,
    accessibility: paper.repo.accessibility,
    host: (() => {
      try {
        return new URL(paper.repo.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })(),
    paperIds: [paper.id],
    paperSlugs: [paper.slug],
    paperTitles: [paper.title],
    categories: [...paper.category],
    modalities: [...paper.modality]
  });
}

// --- How much each criterion actually tells you -------------------------------------------
//
// Measured over the corpus rather than assumed from the rubric. Two criteria fail on the
// numbers: "Build Time" is scored for 6 of 60 records, and "Application Level" gives 45 of
// 60 records the same value. Neither separates one build from another, so neither is shown
// on the site -- both stay in the CSVs and the master table, which the manuscript cites.
//
// The rest keep their score, but the score is rendered against the range the corpus really
// uses. Eight of the ten criteria never award a 1 or a 5, so a bare "3/5" reads as a poor
// mark when it is in fact the median. Carrying observedMin/observedMax lets the page say so.

const MIN_SCORED_SHARE = 0.5;   // a criterion scored for under half the corpus cannot rank it
const MAX_MODE_SHARE = 0.7;     // one value on 70%+ of records is a label, not a measurement

const criteriaStats = criteriaNames.map((name) => {
  const id = slugify(name);
  const values = papers
    .map((paper) => paper.criteriaAssessment.criteria.find((c) => c.id === id)?.value)
    .filter(Number.isFinite);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const modeCount = values.length > 0 ? Math.max(...counts.values()) : 0;
  const scoredShare = papers.length > 0 ? values.length / papers.length : 0;
  const modeShare = values.length > 0 ? modeCount / values.length : 1;

  let withheldReason = "";
  if (scoredShare < MIN_SCORED_SHARE) {
    withheldReason = `scored for only ${values.length} of ${papers.length} records`;
  } else if (modeShare > MAX_MODE_SHARE) {
    withheldReason = `${Math.round(modeShare * 100)}% of records share one value`;
  }

  const { displayName, shortName } = criterionLabels(name);
  return {
    id,
    name: displayName,
    shortName,
    scoredCount: values.length,
    totalCount: papers.length,
    observedMin: values.length > 0 ? Math.min(...values) : null,
    observedMax: values.length > 0 ? Math.max(...values) : null,
    modeShare: Math.round(modeShare * 100) / 100,
    display: withheldReason === "",
    withheldReason
  };
});

const criteriaStatsById = new Map(criteriaStats.map((stat) => [stat.id, stat]));

// Annotate every paper's criteria in place so pages can filter and label without re-deriving.
for (const paper of papers) {
  for (const criterion of paper.criteriaAssessment.criteria) {
    const stat = criteriaStatsById.get(criterion.id);
    criterion.display = stat ? stat.display : true;
    criterion.observedMin = stat ? stat.observedMin : null;
    criterion.observedMax = stat ? stat.observedMax : null;
  }
  // The headline average should only average what the site is willing to show.
  const shown = paper.criteriaAssessment.criteria
    .filter((criterion) => criterion.display && Number.isFinite(criterion.value))
    .map((criterion) => criterion.value);
  paper.criteriaAssessment.displayedCriteriaCount = shown.length;
  paper.criteriaAssessment.averageScore = shown.length > 0
    ? Math.round((shown.reduce((sum, value) => sum + value, 0) / shown.length) * 10) / 10
    : null;
}

const repos = [...repoMap.values()]
  .map((repo) => ({
    ...repo,
    paperIds: unique(repo.paperIds),
    paperSlugs: unique(repo.paperSlugs),
    paperTitles: unique(repo.paperTitles),
    categories: unique(repo.categories),
    modalities: unique(repo.modalities),
    paperCount: unique(repo.paperIds).length
  }))
  .sort((a, b) => b.paperCount - a.paperCount || a.name.localeCompare(b.name));

const toolMap = new Map();

for (const paper of papers) {
  const rawToolNames = unique([
    ...splitLooseList(paper.systemOrTechnology),
    ...(!paper.systemOrTechnology ? [inferNamedTool(paper.title)] : [])
  ]).filter(isToolLikeName);
  const toolNames = unique(rawToolNames.map(normalizeToolName)).filter(Boolean);

  for (const name of toolNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const aliases = unique([
      ...rawToolNames.filter((candidate) => normalizeToolName(candidate) === name),
      ...(TOOL_EXPLICIT_ALIASES.get(name) || [])
    ]).filter((alias) => alias !== name);
    const existing = toolMap.get(slug);
    if (existing) {
      existing.paperIds.push(paper.id);
      existing.paperSlugs.push(paper.slug);
      existing.paperTitles.push(paper.title);
      existing.categories.push(...paper.category);
      existing.modalities.push(...paper.modality);
      existing.repoIds.push(...(paper.repo ? [paper.repo.id] : []));
      existing.repoSlugs.push(...(paper.repo ? [paper.repo.slug] : []));
      existing.skillTags.push(...paper.technicalSkillsNeeded);
      existing.skillLevels.push(paper.derived.skillLevel);
      existing.buildComplexities.push(paper.buildComplexity);
      existing.documentationScores.push(paper.derived.documentationScore);
      existing.workshopFlags.push(paper.derived.workshopReady);
      existing.aliases.push(...aliases);
      continue;
    }

    toolMap.set(slug, {
      id: `tool-${slug}`,
      slug,
      name,
      description: paper.summary || paper.whyItMatters || "",
      paperIds: [paper.id],
      paperSlugs: [paper.slug],
      paperTitles: [paper.title],
      categories: [...paper.category],
      modalities: [...paper.modality],
      repoIds: paper.repo ? [paper.repo.id] : [],
      repoSlugs: paper.repo ? [paper.repo.slug] : [],
      skillTags: [...paper.technicalSkillsNeeded],
      skillLevels: [paper.derived.skillLevel],
      buildComplexities: [paper.buildComplexity],
      documentationScores: [paper.derived.documentationScore],
      workshopFlags: [paper.derived.workshopReady],
      aliases
    });
  }
}

const tools = [...toolMap.values()]
  .map((tool) => ({
    ...tool,
    categories: unique(tool.categories),
    modalities: unique(tool.modalities),
    repoIds: unique(tool.repoIds),
    repoSlugs: unique(tool.repoSlugs),
    paperIds: unique(tool.paperIds),
    paperSlugs: unique(tool.paperSlugs),
    paperTitles: unique(tool.paperTitles),
    skillTags: unique(tool.skillTags),
    skillLevels: unique(tool.skillLevels),
    buildComplexities: unique(tool.buildComplexities.filter(Boolean)),
    aliases: unique(tool.aliases),
    documentationScore:
      tool.documentationScores.length > 0
        ? Math.round(tool.documentationScores.reduce((sum, value) => sum + value, 0) / tool.documentationScores.length)
        : 0,
    documentationTier: documentationTierForScore(
      tool.documentationScores.length > 0
        ? Math.round(tool.documentationScores.reduce((sum, value) => sum + value, 0) / tool.documentationScores.length)
        : 0
    ),
    workshopPaperCount: tool.workshopFlags.filter(Boolean).length,
    paperCount: unique(tool.paperIds).length,
    repoCount: unique(tool.repoIds).length
  }))
  .map((tool) => {
    const linkedPapers = unique(tool.paperIds)
      .map((id) => papers.find((paper) => paper.id === id))
      .filter(Boolean)
      .sort((a, b) => b.derived.documentationScore - a.derived.documentationScore);
    const bestPaper = linkedPapers[0];
    const perspectiveSnippet = cleanText(
      bestPaper?.whyItMatters || bestPaper?.summary || tool.description || ""
    );
    return {
      ...tool,
      assetIds: [],
      assetSlugs: [],
      assetTypes: [],
      replicationStatus: replicationStatusForTool(tool),
      perspectiveSnippet
    };
  })
  .sort((a, b) => b.paperCount - a.paperCount || a.name.localeCompare(b.name));

const topicMap = new Map();

for (const paper of papers) {
  const topicNames = unique(paper.category.map(normalizeCategoryLabel)).filter(Boolean);

  for (const name of topicNames) {
    const slug = slugify(name);
    const aliases = unique(
      paper.category
        .map(cleanText)
        .filter((candidate) => normalizeCategoryLabel(candidate) === name && candidate !== name)
    );
    const existing = topicMap.get(slug);
    if (existing) {
      existing.paperIds.push(paper.id);
      existing.paperSlugs.push(paper.slug);
      existing.paperTitles.push(paper.title);
      existing.modalities.push(...paper.modality);
      existing.aliases.push(...aliases);
      if (paper.repo) {
        existing.repoIds.push(paper.repo.id);
        existing.repoSlugs.push(paper.repo.slug);
      }
      continue;
    }

    topicMap.set(slug, {
      id: `topic-${slug}`,
      slug,
      name,
      paperIds: [paper.id],
      paperSlugs: [paper.slug],
      paperTitles: [paper.title],
      modalities: [...paper.modality],
      aliases,
      repoIds: paper.repo ? [paper.repo.id] : [],
      repoSlugs: paper.repo ? [paper.repo.slug] : []
    });
  }
}

const topics = [...topicMap.values()]
  .map((topic) => {
    const relatedTools = tools.filter((tool) =>
      tool.categories.some((category) => normalizeCategoryLabel(category) === topic.name)
    );
    return {
      ...topic,
      paperIds: unique(topic.paperIds),
      paperSlugs: unique(topic.paperSlugs),
      paperTitles: unique(topic.paperTitles),
      modalities: unique(topic.modalities),
      aliases: unique(topic.aliases),
      repoIds: unique(topic.repoIds),
      repoSlugs: unique(topic.repoSlugs),
      toolIds: relatedTools.map((tool) => tool.id),
      toolSlugs: relatedTools.map((tool) => tool.slug),
      paperCount: unique(topic.paperIds).length,
      repoCount: unique(topic.repoIds).length,
      toolCount: relatedTools.length
    };
  })
  .sort((a, b) => b.paperCount - a.paperCount || a.name.localeCompare(b.name));

const curatedAssetRowsByPaperSlug = new Map();
const curatedEventRowsByPaperSlug = new Map();

for (const row of curatedManifest) {
  const recordType = cleanText(row.record_type).toLowerCase();
  const paperSlug = cleanText(row.paper_slug);
  if (!paperSlug) continue;

  if (recordType === "asset") {
    const current = curatedAssetRowsByPaperSlug.get(paperSlug) || [];
    current.push({
      type: cleanText(row.artifact_type).toLowerCase(),
      format: cleanText(row.format) || toTitleCase(cleanText(row.artifact_type).toLowerCase()),
      name: cleanText(row.name),
      url: cleanText(row.url),
      evidence: cleanText(row.evidence),
      notes: cleanText(row.notes)
    });
    curatedAssetRowsByPaperSlug.set(paperSlug, current);
  }

  if (recordType === "event") {
    const current = curatedEventRowsByPaperSlug.get(paperSlug) || [];
    current.push({
      type: cleanText(row.event_type).toLowerCase(),
      name: cleanText(row.name),
      url: cleanText(row.url),
      venue: cleanText(row.venue),
      notes: cleanText(row.notes)
    });
    curatedEventRowsByPaperSlug.set(paperSlug, current);
  }
}

const assetMap = new Map();

for (const paper of papers) {
  const curatedRows = curatedAssetRowsByPaperSlug.get(paper.slug) || [];
  const curatedTypes = new Set();

  for (const row of curatedRows) {
    if (!row.type) continue;
    curatedTypes.add(row.type);
    const key = `${paper.id}:${row.type}`;
    if (assetMap.has(key)) continue;
    const slug = slugify(`${row.type}-${paper.title}`);
    assetMap.set(key, {
      id: `asset-${slug}`,
      slug,
      name: row.name || `${toTitleCase(row.type)} for ${paper.title}`,
      type: row.type,
      format: row.format || toTitleCase(row.type),
      evidence: row.evidence || `Curated ${row.type} support for ${paper.title}.`,
      url: row.url,
      provenanceSource: "manifest",
      notes: row.notes,
      paperIds: [paper.id],
      paperSlugs: [paper.slug],
      toolIds: [],
      toolSlugs: [],
      repoIds: paper.repo ? [paper.repo.id] : [],
      repoSlugs: paper.repo ? [paper.repo.slug] : []
    });
  }

  const signals = extractAssetSignals(paper);
  for (const signal of signals) {
    if (curatedTypes.has(signal.type)) continue;
    const key = `${paper.id}:${signal.type}`;
    if (assetMap.has(key)) continue;
    const slug = slugify(`${signal.type}-${paper.title}`);
    assetMap.set(key, {
      id: `asset-${slug}`,
      slug,
      name: `${toTitleCase(signal.type)} for ${paper.title}`,
      type: signal.type,
      format: signal.format,
      evidence: signal.evidence,
      url: signal.url,
      provenanceSource: "heuristic",
      notes: "",
      paperIds: [paper.id],
      paperSlugs: [paper.slug],
      toolIds: [],
      toolSlugs: [],
      repoIds: paper.repo ? [paper.repo.id] : [],
      repoSlugs: paper.repo ? [paper.repo.slug] : []
    });
  }
}

const assets = [...assetMap.values()]
  .map((asset) => ({
    ...asset,
    paperIds: unique(asset.paperIds),
    paperSlugs: unique(asset.paperSlugs),
    toolIds: unique(asset.toolIds),
    toolSlugs: unique(asset.toolSlugs),
    repoIds: unique(asset.repoIds),
    repoSlugs: unique(asset.repoSlugs),
    paperCount: unique(asset.paperIds).length,
    toolCount: unique(asset.toolIds).length
  }))
  .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

const eventMap = new Map();
for (const paper of papers) {
  const curatedRows = curatedEventRowsByPaperSlug.get(paper.slug) || [];
  if (curatedRows.length > 0) {
    for (const row of curatedRows) {
      if (!row.type || !row.name) continue;
      const slug = slugify(row.name);
      const existing = eventMap.get(slug);
      if (existing) {
        existing.paperIds.push(paper.id);
        existing.paperSlugs.push(paper.slug);
        existing.paperTitles.push(paper.title);
        continue;
      }
      eventMap.set(slug, {
        id: `event-${slug}`,
        slug,
        name: row.name,
        type: row.type,
        venue: row.venue || paper.venue,
        url: row.url || paper.primaryLink || "",
        provenanceSource: "manifest",
        notes: row.notes,
        paperIds: [paper.id],
        paperSlugs: [paper.slug],
        paperTitles: [paper.title]
      });
    }
    continue;
  }

  const eventType = inferEventType(paper.venue, paper.type, paper.primaryLink);
  if (!eventType) continue;
  const name = cleanText(paper.venue.split("|")[0]) || cleanText(paper.type);
  if (!name || name.toLowerCase() === "event") continue;
  const slug = slugify(name);
  const existing = eventMap.get(slug);
  if (existing) {
    existing.paperIds.push(paper.id);
    existing.paperSlugs.push(paper.slug);
    existing.paperTitles.push(paper.title);
    continue;
  }
  eventMap.set(slug, {
    id: `event-${slug}`,
    slug,
    name,
    type: eventType,
    venue: paper.venue,
    url: paper.primaryLink || "",
    provenanceSource: "heuristic",
    notes: "",
    paperIds: [paper.id],
    paperSlugs: [paper.slug],
    paperTitles: [paper.title]
  });
}

const events = [...eventMap.values()]
  .map((event) => ({
    ...event,
    paperIds: unique(event.paperIds),
    paperSlugs: unique(event.paperSlugs),
    paperTitles: unique(event.paperTitles),
    paperCount: unique(event.paperIds).length
  }))
  .sort((a, b) => b.paperCount - a.paperCount || a.name.localeCompare(b.name));

const toolsByPaperId = new Map();
for (const tool of tools) {
  for (const paperId of tool.paperIds) {
    const current = toolsByPaperId.get(paperId) || [];
    current.push({ id: tool.id, slug: tool.slug, name: tool.name });
    toolsByPaperId.set(paperId, current);
  }
}

const topicsByPaperId = new Map();
for (const topic of topics) {
  for (const paperId of topic.paperIds) {
    const current = topicsByPaperId.get(paperId) || [];
    current.push({ id: topic.id, slug: topic.slug, name: topic.name });
    topicsByPaperId.set(paperId, current);
  }
}

for (const paper of papers) {
  const linkedTools = toolsByPaperId.get(paper.id) || [];
  const linkedTopics = topicsByPaperId.get(paper.id) || [];
  paper.toolIds = linkedTools.map((tool) => tool.id);
  paper.toolSlugs = linkedTools.map((tool) => tool.slug);
  paper.toolNames = linkedTools.map((tool) => tool.name);
  paper.topicIds = linkedTopics.map((topic) => topic.id);
  paper.topicSlugs = linkedTopics.map((topic) => topic.slug);
  paper.topicNames = linkedTopics.map((topic) => topic.name);
  const linkedAssets = assets.filter((asset) => asset.paperIds.includes(paper.id));
  const linkedEvents = events.filter((event) => event.paperIds.includes(paper.id));
  paper.assetIds = linkedAssets.map((asset) => asset.id);
  paper.assetSlugs = linkedAssets.map((asset) => asset.slug);
  paper.assetTypes = unique(linkedAssets.map((asset) => asset.type));
  paper.eventIds = linkedEvents.map((event) => event.id);
  paper.eventSlugs = linkedEvents.map((event) => event.slug);
  paper.eventNames = linkedEvents.map((event) => event.name);
}

for (const tool of tools) {
  const linkedAssets = assets.filter((asset) => asset.paperIds.some((paperId) => tool.paperIds.includes(paperId)));
  tool.assetIds = linkedAssets.map((asset) => asset.id);
  tool.assetSlugs = linkedAssets.map((asset) => asset.slug);
  tool.assetTypes = unique(linkedAssets.map((asset) => asset.type));
}

for (const asset of assets) {
  asset.toolIds = tools.filter((tool) => asset.paperIds.some((paperId) => tool.paperIds.includes(paperId))).map((tool) => tool.id);
  asset.toolSlugs = tools.filter((tool) => asset.paperIds.some((paperId) => tool.paperIds.includes(paperId))).map((tool) => tool.slug);
  asset.toolCount = unique(asset.toolIds).length;
}

const pageIndexChunks = [];

function collectPageIndexChunks(paper, nodes, level = 0, parentNodeId = "") {
  for (const node of nodes || []) {
    const nodeId = cleanText(node.node_id);
    if (!nodeId) continue;
    const title = cleanText(node.title) || `Section ${nodeId}`;
    const summary = cleanText(node.summary);
    const childNodes = Array.isArray(node.nodes) ? node.nodes : [];
    const childNodeIds = childNodes.map((child) => cleanText(child.node_id)).filter(Boolean);
    const chunkSlug = `${paper.slug}-${nodeId}-${slugify(title).slice(0, 48)}`;
    const semanticSignals = unique([
      ...inferSemanticSignals(`${title} ${summary}`),
      ...paper.assetTypes,
      ...(paper.derived.workshopReady ? ["workshop-ready"] : []),
      ...tokenize(paper.category.join(" ")).slice(0, 6)
    ]);
    const searchText = buildChunkSearchText(paper, title, summary, semanticSignals);

    pageIndexChunks.push({
      id: `chunk-${paper.slug}-${nodeId}`,
      slug: chunkSlug,
      url: `/sections/${chunkSlug}`,
      paperId: paper.id,
      paperSlug: paper.slug,
      paperTitle: paper.title,
      paperUrl: `/papers/${paper.slug}`,
      nodeId,
      title,
      summary,
      level,
      startIndex: Number.isFinite(node.start_index) ? node.start_index : null,
      endIndex: Number.isFinite(node.end_index) ? node.end_index : null,
      pageSpanLabel: pageSpanLabel(node.start_index, node.end_index),
      parentNodeId,
      parentChunkId: "",
      parentChunkSlug: "",
      childNodeIds,
      childChunkIds: [],
      childChunkSlugs: [],
      category: paper.category,
      modality: paper.modality,
      topicIds: paper.topicIds,
      topicSlugs: paper.topicSlugs,
      topicNames: paper.topicNames,
      toolIds: paper.toolIds,
      toolSlugs: paper.toolSlugs,
      toolNames: paper.toolNames,
      assetIds: paper.assetIds,
      assetSlugs: paper.assetSlugs,
      assetTypes: paper.assetTypes,
      eventIds: paper.eventIds,
      eventSlugs: paper.eventSlugs,
      eventNames: paper.eventNames,
      repoIds: paper.repo ? [paper.repo.id] : [],
      repoSlugs: paper.repo ? [paper.repo.slug] : [],
      repoNames: paper.repo ? [paper.repo.name] : [],
      hasPdf: Boolean(paper.pdf.localPath),
      hasPageIndex: paper.pageIndex.available,
      workshopReady: paper.derived.workshopReady,
      documentationTier: paper.derived.documentationTier,
      pageIndexPublicPath: paper.pageIndex.publicPath,
      pageIndexOutputPath: paper.pageIndex.outputPath,
      searchText,
      semanticText: unique([title, summary, paper.summary, paper.whyItMatters, paper.function]).join(" "),
      semanticSignals
    });

    collectPageIndexChunks(paper, childNodes, level + 1, nodeId);
  }
}

for (const paper of papers) {
  if (!paper.pageIndex.available || !paper.pageIndex.outputPath || !fs.existsSync(paper.pageIndex.outputPath)) continue;
  try {
    const payload = readJson(paper.pageIndex.outputPath);
    collectPageIndexChunks(paper, payload.structure || []);
  } catch (error) {
    console.warn(`Skipping PageIndex chunks for ${paper.slug}: ${error.message}`);
  }
}

const pageIndexChunkByPaperNode = new Map(
  pageIndexChunks.map((chunk) => [`${chunk.paperId}:${chunk.nodeId}`, chunk])
);

for (const chunk of pageIndexChunks) {
  if (chunk.parentNodeId) {
    const parentChunk = pageIndexChunkByPaperNode.get(`${chunk.paperId}:${chunk.parentNodeId}`);
    if (parentChunk) {
      chunk.parentChunkId = parentChunk.id;
      chunk.parentChunkSlug = parentChunk.slug;
    }
  }

  const childChunks = chunk.childNodeIds
    .map((childNodeId) => pageIndexChunkByPaperNode.get(`${chunk.paperId}:${childNodeId}`))
    .filter(Boolean);
  chunk.childChunkIds = childChunks.map((child) => child.id);
  chunk.childChunkSlugs = childChunks.map((child) => child.slug);
}

pageIndexChunks.sort((a, b) =>
  a.paperSlug.localeCompare(b.paperSlug) ||
  a.level - b.level ||
  a.nodeId.localeCompare(b.nodeId)
);

const topicByName = new Map(topics.map((topic) => [topic.name, topic]));
const topicRefsForNames = (names) =>
  unique(names.map(normalizeCategoryLabel))
    .map((name) => topicByName.get(name))
    .filter(Boolean)
    .map((topic) => ({ id: topic.id, slug: topic.slug, name: topic.name }));
const topicRefsForPaperIds = (paperIds) =>
  topicRefsForNames(
    unique(paperIds)
      .map((paperId) => papers.find((paper) => paper.id === paperId))
      .filter(Boolean)
      .flatMap((paper) => paper.topicNames)
  );

const graphNodes = [
  ...papers.map((paper) => {
    const topicRefs = topicRefsForNames(paper.topicNames);
    return {
      id: paper.id,
      type: "paper",
      slug: paper.slug,
      label: paper.title,
      meta: [paper.year, paper.venue].filter(Boolean).join(" · "),
      url: `/papers/${paper.slug}`,
      topicIds: topicRefs.map((topic) => topic.id),
      topicSlugs: topicRefs.map((topic) => topic.slug),
      topicNames: topicRefs.map((topic) => topic.name),
      criteriaAssessed: paper.criteriaAssessment.assessed,
      criteriaRubricMapped: paper.criteriaAssessment.rubricMapped,
      criteriaTechnologyType: paper.criteriaAssessment.technologyType,
      criteriaAverage: paper.criteriaAssessment.averageScore,
      criteriaScores: Object.fromEntries(
        paper.criteriaAssessment.criteria.map((criterion) => [criterion.id, criterion.value])
      )
    };
  }),
  ...tools.map((tool) => {
    const topicRefs = topicRefsForNames(tool.categories);
    return {
      id: tool.id,
      type: "tool",
      slug: tool.slug,
      label: tool.name,
      meta: `${tool.paperCount} linked ${tool.paperCount === 1 ? "paper" : "papers"}`,
      url: `/tools/${tool.slug}`,
      topicIds: topicRefs.map((topic) => topic.id),
      topicSlugs: topicRefs.map((topic) => topic.slug),
      topicNames: topicRefs.map((topic) => topic.name)
    };
  }),
  ...topics.map((topic) => ({
    id: topic.id,
    type: "topic",
    slug: topic.slug,
    label: topic.name,
    meta: `${topic.paperCount} papers · ${topic.toolCount} tools`,
    url: `/topics/${topic.slug}`,
    topicIds: [topic.id],
    topicSlugs: [topic.slug],
    topicNames: [topic.name]
  })),
  ...repos.map((repo) => {
    const topicRefs = topicRefsForNames(repo.categories);
    return {
      id: repo.id,
      type: "repo",
      slug: repo.slug,
      label: repo.name,
      meta: `${repo.kind} · ${repo.paperCount} linked ${repo.paperCount === 1 ? "paper" : "papers"}`,
      url: `/repos/${repo.slug}`,
      topicIds: topicRefs.map((topic) => topic.id),
      topicSlugs: topicRefs.map((topic) => topic.slug),
      topicNames: topicRefs.map((topic) => topic.name)
    };
  }),
  ...assets.map((asset) => {
    const topicRefs = topicRefsForPaperIds(asset.paperIds);
    return {
      id: asset.id,
      type: "asset",
      slug: asset.slug,
      label: asset.name,
      meta: `${asset.type} · ${asset.paperCount} linked ${asset.paperCount === 1 ? "paper" : "papers"}`,
      url: `/assets/${asset.slug}`,
      topicIds: topicRefs.map((topic) => topic.id),
      topicSlugs: topicRefs.map((topic) => topic.slug),
      topicNames: topicRefs.map((topic) => topic.name)
    };
  })
];

const graphEdges = [];
const edgeSeen = new Set();

function pushEdge(source, target, relation) {
  const key = `${source}::${target}::${relation}`;
  if (edgeSeen.has(key)) return;
  edgeSeen.add(key);
  graphEdges.push({ source, target, relation });
}

for (const paper of papers) {
  for (const toolId of paper.toolIds) pushEdge(paper.id, toolId, "describes");
  for (const topicId of paper.topicIds) pushEdge(paper.id, topicId, "belongs_to_topic");
  for (const assetId of paper.assetIds) pushEdge(paper.id, assetId, "has_asset");
  if (paper.repo) pushEdge(paper.id, paper.repo.id, "links_to_repo");
}

for (const tool of tools) {
  for (const repoId of tool.repoIds) pushEdge(tool.id, repoId, "implemented_by_repo");
  for (const assetId of tool.assetIds) pushEdge(tool.id, assetId, "has_asset");
  for (const category of tool.categories.map(normalizeCategoryLabel)) {
    const topic = topics.find((item) => item.name === category);
    if (topic) pushEdge(tool.id, topic.id, "in_topic");
  }
}

for (const topic of topics) {
  for (const repoId of topic.repoIds) pushEdge(topic.id, repoId, "contains_repo");
}

const graph = {
  nodes: graphNodes,
  edges: graphEdges,
  criteria: criteriaNames.map((name) => ({ id: slugify(name), name })),
  counts: {
    papers: papers.length,
    tools: tools.length,
    topics: topics.length,
    repos: repos.length,
    assets: assets.length,
    events: 0,
    edges: graphEdges.length
  }
};

const topicCollectionDescriptions = {
  "Liquid Handling": "Papers centered on pipetting, dispensing, pumps, autosamplers, liquid-handling robots, and fluid-transfer workflows.",
  Bioprinting: "Papers focused on open-source bioprinters, extrusion printheads, bioink deposition, and tissue-fabrication platforms.",
  Microfabrication: "Papers covering accessible microfabrication, lithography, molds, custom printer modifications, and small-feature manufacturing.",
  "Laboratory Automation": "Papers about laboratory robotics, automated workflows, cell culture automation, and self-driving-lab infrastructure.",
  "Microscopy & Imaging": "Papers focused on open-source microscopes, imaging systems, optical alignment, and instrument add-ons.",
  "Prosthetics & Assistive Devices": "Papers about open hardware prosthetics, assistive devices, EMG systems, and related fabrication approaches.",
  "Bioreactors & Cell Culture": "Papers covering bioreactors, incubation, tissue culture platforms, organoid support, and cell-growth systems.",
  Microfluidics: "Papers focused on microfluidic chips, perfusion, pumps, droplet systems, and fluidic device workflows.",
  Electrospinning: "Papers about open-source electrospinning, melt electrowriting, and microfiber fabrication systems.",
  "Open Hardware Methods": "Papers that primarily contribute open-hardware methods, principles, or community infrastructure.",
  "Custom Printer": "Papers focused on custom printer architectures or modifications for laboratory fabrication workflows.",
  "Organ-on-chip": "Papers focused on organ-on-chip systems and connected tissue-engineering platforms."
};

const topicCollections = [...new Set(papers.flatMap((paper) => paper.category))]
  .sort((a, b) => {
    const countDiff =
      papers.filter((paper) => paper.category.includes(b)).length -
      papers.filter((paper) => paper.category.includes(a)).length;
    return countDiff || a.localeCompare(b);
  })
  .map((category) => ({
    id: `collection-topic-${slugify(category)}`,
    slug: `topic-${slugify(category)}`,
    name: category,
    description:
      topicCollectionDescriptions[category] ||
      `Papers tagged with ${category} in the curated biofabrication corpus.`,
    rationale: "Generated directly from the paper category fields so every paper belongs to at least one topical collection.",
    papers: papers
      .filter((paper) => paper.category.includes(category))
      .sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title))
  }));

const practicalCollections = [
  {
    id: "collection-workshop-ready",
    slug: "workshop-ready",
    name: "Workshop-ready tools",
    description: "Lower-barrier records with enough documented evidence to support teaching, demos, or guided replication.",
    rationale: "Derived from explicit corpus signals, linked resources, a manageable skill profile, and open-source status.",
    papers: papers.filter((paper) => paper.derived.workshopReady)
  },
  {
    id: "collection-strong-documentation",
    slug: "strong-documentation",
    name: "Strongest documentation",
    description: "Papers with the densest practical evidence trail across publication, repository, and build-resource records.",
    rationale: "Sorted by derived documentation score from source links, repositories, assessments, and explicit open-source resource references.",
    papers: [...papers]
      .filter((paper) => paper.derived.documentationScore >= 4)
      .sort((a, b) => b.derived.documentationScore - a.derived.documentationScore || a.title.localeCompare(b.title))
  },
  {
    id: "collection-low-engineering-capacity",
    slug: "low-engineering-capacity",
    name: "Low engineering capacity",
    description: "Records more suitable for biology labs or classrooms without deep robotics or electronics capacity.",
    rationale: "Derived from low or medium skill/engineering barrier, plus preference for low-cost or easy-build signals when present.",
    papers: papers.filter(
      (paper) =>
        paper.derived.engineeringBarrier === "low" ||
        (paper.derived.engineeringBarrier === "medium" &&
          paper.derived.skillLevel !== "high" &&
          (paper.lowCost === true || paper.easyToBuild === true))
    )
  },
  {
    id: "collection-advanced-builds",
    slug: "advanced-builds",
    name: "Advanced builds",
    description: "Higher-barrier systems that likely need stronger engineering, robotics, firmware, or fabrication capacity.",
    rationale: "Derived from high skill or engineering barrier signals in the curated metadata.",
    papers: papers.filter(
      (paper) => paper.derived.skillLevel === "high" || paper.derived.engineeringBarrier === "high"
    )
  },
  {
    id: "collection-with-cad",
    slug: "with-cad",
    name: "With CAD assets",
    description: "Papers with explicit CAD or design-file evidence in the curated corpus.",
    rationale: "Derived from explicit CAD, STL, STEP, Fusion 360, SolidWorks, or design-file mentions in the structured fields.",
    papers: papers.filter((paper) => paper.assetTypes.some((assetType) => assetType.toLowerCase() === "cad"))
  }
];

const collections = [...practicalCollections, ...topicCollections].map((collection) => ({
  id: collection.id,
  slug: collection.slug,
  name: collection.name,
  description: collection.description,
  rationale: collection.rationale,
  paperIds: collection.papers.map((paper) => paper.id),
  paperSlugs: collection.papers.map((paper) => paper.slug),
  paperCount: collection.papers.length
})).filter((collection) => collection.paperCount > 0);

const categoryCounts = Object.entries(
  papers.reduce((acc, paper) => {
    for (const item of paper.category) {
      acc[item] = (acc[item] || 0) + 1;
    }
    return acc;
  }, {})
)
  .sort((a, b) => b[1] - a[1])
  .map(([label, count]) => ({ label, count }));

const skillTagMap = new Map();

for (const paper of papers) {
  for (const tag of paper.technicalSkillsNeeded) {
    const cleaned = cleanText(tag);
    if (!cleaned) continue;
    const slug = slugify(cleaned);
    if (!slug) continue;
    const existing = skillTagMap.get(slug);
    if (existing) {
      existing.paperIds.push(paper.id);
      existing.paperSlugs.push(paper.slug);
      existing.toolIds.push(...paper.toolIds);
      existing.assetIds.push(...paper.assetIds);
      existing.skillLevels.push(paper.derived.skillLevel);
      continue;
    }
    skillTagMap.set(slug, {
      id: `skill-${slug}`,
      slug,
      name: toDisplaySkillName(cleaned),
      kind: "tag",
      level: null,
      paperIds: [paper.id],
      paperSlugs: [paper.slug],
      toolIds: [...paper.toolIds],
      assetIds: [...paper.assetIds],
      skillLevels: [paper.derived.skillLevel]
    });
  }
}

const levelSkills = ["low", "medium", "high"].map((level) => {
  const levelPapers = papers.filter((paper) => paper.derived.skillLevel === level);
  const levelTools = tools.filter((tool) => tool.skillLevels.includes(level));
  const label = toDisplaySkillName(level);
  return {
    id: `skill-level-${level}`,
    slug: `level-${level}`,
    name: `${label} Skill Barrier`,
    kind: "level",
    level,
    paperIds: levelPapers.map((paper) => paper.id),
    paperSlugs: levelPapers.map((paper) => paper.slug),
    toolIds: unique(levelTools.map((tool) => tool.id)),
    toolSlugs: unique(levelTools.map((tool) => tool.slug)),
    assetIds: unique(levelPapers.flatMap((paper) => paper.assetIds)),
    skillLevels: [level],
    paperCount: levelPapers.length,
    toolCount: levelTools.length
  };
});

const skills = [
  ...levelSkills,
  ...[...skillTagMap.values()].map((skill) => ({
    ...skill,
    paperIds: unique(skill.paperIds),
    paperSlugs: unique(skill.paperSlugs),
    toolIds: unique(skill.toolIds),
    toolSlugs: unique(
      unique(skill.toolIds)
        .map((id) => tools.find((tool) => tool.id === id)?.slug)
        .filter(Boolean)
    ),
    assetIds: unique(skill.assetIds),
    skillLevels: unique(skill.skillLevels),
    paperCount: unique(skill.paperIds).length,
    toolCount: unique(skill.toolIds).length
  }))
].sort((a, b) => {
  if (a.kind === "level" && b.kind !== "level") return -1;
  if (b.kind === "level" && a.kind !== "level") return 1;
  return a.name.localeCompare(b.name);
});

const stats = {
  paperCount: papers.length,
  curatedPaperCount: papers.filter((paper) => paper.sourceScope === "curated").length,
  supplementalPaperCount: papers.filter((paper) => paper.sourceScope === "supplemental").length,
  mappedToolPaperCount: papers.filter((paper) => paper.toolIds.length > 0).length,
  criteriaAssessedCount: papers.filter((paper) => paper.criteriaAssessment.assessed).length,
  criteriaMappedCount: papers.filter((paper) => paper.criteriaAssessment.rubricMapped).length,
  pdfCount: papers.filter((paper) => paper.pdf.localPath).length,
  pageIndexCount: papers.filter((paper) => paper.pageIndex.available).length,
  pageIndexChunkCount: 0,
  repoCount: repos.length,
  toolCount: tools.length,
  topicCount: topics.length,
  assetCount: assets.length,
  eventCount: events.length,
  skillCount: skills.length,

  // Provenance figures the manuscript cites. Counted here so the prose on /about cannot
  // drift from the corpus, and so "unknown" stays distinct from "no" -- two records have no
  // OpenAlex entry at all, which is not the same as being closed or unretracted.
  yearMin: Math.min(...papers.map((paper) => paper.year).filter(Number.isFinite)),
  yearMax: Math.max(...papers.map((paper) => paper.year).filter(Number.isFinite)),
  openAccessCount: papers.filter((paper) => paper.publication?.openAlex?.openAccess?.isOpen === true).length,
  closedAccessCount: papers.filter((paper) => paper.publication?.openAlex?.openAccess?.isOpen === false).length,
  accessUnknownCount: papers.filter((paper) => paper.publication?.openAlex?.openAccess?.isOpen == null).length,
  retractionCheckedCount: papers.filter((paper) => paper.publication?.openAlex?.isRetracted === false).length,
  retractedCount: papers.filter((paper) => paper.publication?.openAlex?.isRetracted === true).length,
  doiCount: papers.filter((paper) => paper.doi).length,
  costStatedCount: papers.filter((paper) => (paper.approximateCost || "").split("|")[0].trim()).length,
  licenceCount: papers.filter((paper) => paper.artifactLicence?.value).length,
  reachableRepoCount: papers.filter((paper) => paper.repo).length,
  unverifiedRepoLinkCount: papers.filter((paper) => (paper.textRepoLinks ?? []).length > 0 && !paper.repo).length,
  fullTextHeldCount: papers.filter((paper) => paper.reportedMetrics?.fullTextRead).length,
  standardComplianceCount: papers.filter((paper) =>
    (paper.reportedMetrics?.metrics ?? []).some((metric) => metric.id === "standard-compliance" && metric.status === "yes")
  ).length,

  categoryCounts
};

fs.writeFileSync(path.join(outDir, "papers.json"), JSON.stringify(papers, null, 2));
fs.writeFileSync(path.join(outDir, "repos.json"), JSON.stringify(repos, null, 2));
fs.writeFileSync(path.join(outDir, "tools.json"), JSON.stringify(tools, null, 2));
fs.writeFileSync(path.join(outDir, "topics.json"), JSON.stringify(topics, null, 2));
fs.writeFileSync(path.join(outDir, "assets.json"), JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify(events, null, 2));
fs.writeFileSync(path.join(outDir, "graph.json"), JSON.stringify(graph, null, 2));
fs.writeFileSync(path.join(outDir, "collections.json"), JSON.stringify(collections, null, 2));
fs.writeFileSync(path.join(outDir, "skills.json"), JSON.stringify(skills, null, 2));
fs.writeFileSync(path.join(outDir, "criteria_rubric.json"), JSON.stringify(criteriaRubric, null, 2));
fs.writeFileSync(path.join(outDir, "criteria_stats.json"), JSON.stringify(criteriaStats, null, 2));
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2));

/**
 * What was screened and what was kept. The criteria assessment table holds every paper a
 * curator read, with a "Keep reference" flag; the corpus is the kept rows. Publishing the
 * excluded rows too, grouped by the curators' technology label, is what lets /about and
 * /suggest say plainly what this index is not -- pumps, prosthetics, microscopes -- so a
 * reader does not suggest a syringe pump that was read and set aside two years ago.
 */
const groupFor = (row) => {
  const t = `${row.title} ${row.technology_type}`.toLowerCase();
  if (/prosthe|bionic|myoelectric|emg|robot hand/.test(t)) return "Prosthetics and bionics";
  if (/microscop|imaging|openflexure|photomicro/.test(t)) return "Microscopy and imaging";
  if (/pump|dosing unit|autosampler|fraction collector|venturi/.test(t)) return "Pumps and fluid components";
  if (/library|code for|software|\(code\)|web of things/.test(t)) return "Software only";
  if (/review|past, present|democratizing self-driving labs|advances in/.test(t)) return "Review or perspective";
  if (/preprint|10\.1101\//.test(`${t} ${row.doi}`)) return "Preprint superseded by a published version";
  if (/pcr|incubator|chemistry synthesis|pharmaceutical|microplate handling|cloning workflow|scratches/.test(t)) return "Laboratory automation outside biofabrication";
  return "Adjacent hardware, not a biofabrication build";
};
const keptTitles = new Set(papers.map((paper) => normalizeTitleKey(paper.title)));
const screened = criteriaAssessmentCsv.map((row) => ({
  title: cleanText(row.title),
  doi: cleanText(row.doi),
  technologyType: cleanText(row.technology_type),
  keep: /^y/i.test(cleanText(row["Keep reference (yes or no)"]))
}));
const excluded = screened
  .filter((row) => !row.keep)
  .map((row) => ({ ...row, group: groupFor(row) }))
  .sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
const screening = {
  screened: screened.length,
  kept: screened.filter((row) => row.keep).length,
  inCorpus: papers.length,
  excludedCount: excluded.length,
  groups: [...new Set(excluded.map((row) => row.group))]
    .map((group) => ({ group, count: excluded.filter((row) => row.group === group).length }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group)),
  excluded
};
fs.writeFileSync(path.join(outDir, "screening.json"), JSON.stringify(screening, null, 2));

console.log(`Generated ${papers.length} paper records`);
