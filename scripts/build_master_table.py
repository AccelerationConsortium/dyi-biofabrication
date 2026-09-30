#!/usr/bin/env python3
"""Join every source we hold into one row per corpus paper.

Pulls together:
  lists/derived/unified_papers.csv                  - the curated corpus
  lists/derived/biofabrication_pdf_criteria_assessment.csv - rubric scores, keep flag, build cost
  lists/derived/fulltext_extraction.csv             - fields mined from the paper PDFs
  site/src/data/enrichment/publication_metadata.json - OpenAlex/Crossref (open access, retraction)
  site/src/data/enrichment/repo_accessibility.json  - repo reachability and last activity
  pdfs/ and pdfs/markdown/                          - which full text we actually hold
  site/src/data/generated/papers.json               - the corpus as the site publishes it: the
                                                      repository, licence, cost and file types
                                                      after every curated layer has been applied
  lists/derived/supplementary_manifest.csv          - supplementary files held per record

Columns mined from full text are prefixed ft_ and carry their evidence sentence, so a
reviewer can tell a curated value from an extracted one. Columns prefixed corpus_ are the
resolved values the site shows, each with its source, so the table can be read without
knowing which curated file won. Writes lists/derived/master_table.csv.

Run `node site/scripts/build-corpus.mjs` first so papers.json is current.
"""
import csv
import json
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "lists", "derived", "master_table.csv")


def norm_doi(s):
    s = str(s or "").strip().lower()
    s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s)
    m = re.search(r"10\.\d{4,9}/[^\s]+", s)
    return m.group(0).rstrip(".,;)") if m else ""


def norm_title(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", str(s or "").lower())).strip()


def toks(s):
    return set(w for w in norm_title(s).split() if len(w) > 3)


def overlap(a, b):
    ta, tb = toks(a), toks(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


corpus = read_csv(os.path.join(REPO, "lists", "derived", "unified_papers.csv"))
assessment = read_csv(os.path.join(REPO, "lists", "derived",
                                   "biofabrication_pdf_criteria_assessment.csv"))
fulltext = read_csv(os.path.join(REPO, "lists", "derived", "fulltext_extraction.csv"))
pubmeta = read_json(os.path.join(REPO, "site", "src", "data", "enrichment",
                                 "publication_metadata.json"), {}).get("records", {})
repometa = read_json(os.path.join(REPO, "site", "src", "data", "enrichment",
                                  "repo_accessibility.json"), {}).get("records", {})
corpus_json = read_json(os.path.join(REPO, "site", "src", "data", "generated", "papers.json"), [])
supp_manifest = read_csv(os.path.join(REPO, "lists", "derived", "supplementary_manifest.csv"))

pdf_dir = os.path.join(REPO, "pdfs")
md_dir = os.path.join(REPO, "pdfs", "markdown")
supp_dir = os.path.join(REPO, "pdfs", "supplementary")
pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf")] if os.path.isdir(pdf_dir) else []
md_files = [f for f in os.listdir(md_dir) if f.endswith(".md")] if os.path.isdir(md_dir) else []
supp_files = os.listdir(supp_dir) if os.path.isdir(supp_dir) else []

# ---- lookup indexes -------------------------------------------------------
a_by_doi = {norm_doi(r["doi"]): r for r in assessment if norm_doi(r.get("doi"))}
a_by_title = {norm_title(r["title"]): r for r in assessment}

pm_by_doi, pm_by_title = {}, {}
for v in pubmeta.values():
    d = norm_doi(v.get("resolvedDoi") or v.get("requestedDoi"))
    if d:
        pm_by_doi.setdefault(d, v)
    for t in (v.get("paperTitle"), (v.get("openAlex") or {}).get("title")):
        if t:
            pm_by_title.setdefault(norm_title(t), v)


cj_by_doi = {norm_doi(r.get("doi")): r for r in corpus_json if norm_doi(r.get("doi"))}
cj_by_title = {norm_title(r.get("title")): r for r in corpus_json}
supp_by_title = {}
for r in supp_manifest:
    supp_by_title.setdefault(norm_title(r.get("paper_title")), []).append(r)

METRICS = ["motion-accuracy", "volumetric-accuracy", "cell-viability",
           "unattended-operation", "standard-compliance"]


def best_by_title(title, rows, key, threshold=0.55):
    best, score = None, 0.0
    for r in rows:
        j = overlap(title, r.get(key, ""))
        if j > score:
            best, score = r, j
    return best if score >= threshold else None


def file_for(title, files, strip_ext=True):
    best, score = "", 0.0
    for f in files:
        stem = f.rsplit(".", 1)[0] if strip_ext else f
        j = overlap(title, re.sub(r"^\d+_", "", stem).replace("_", " "))
        if j > score:
            best, score = f, j
    return best if score >= 0.55 else ""


CRITERIA = ["Resolution", "Scalability/Throughput", "Build and Part Sourcing Complexity",
            "Skill Complexity", "Equipment/Cosumable/Facility Requirement Accessibility",
            "Application Level", "Accessibility to documentation",
            "Validation/Troubleshooting Complexity", "Speed/Cycle Time", "Build Time"]

rows_out = []
for c in corpus:
    title = c["paper_title"]
    doi = norm_doi(c.get("doi"))

    a = a_by_doi.get(doi) or a_by_title.get(norm_title(title)) or best_by_title(title, assessment, "title") or {}
    ft = best_by_title(title, fulltext, "title_from_filename") or {}
    pm = pm_by_doi.get(doi) or pm_by_title.get(norm_title(title)) or {}
    oa = (pm.get("openAlex") or {})

    cj = cj_by_doi.get(doi) or cj_by_title.get(norm_title(title)) or {}
    cj_repo = cj.get("repo") or {}
    cj_access = cj_repo.get("accessibility") or {}
    cj_licence = cj.get("artifactLicence") or {}
    cj_metrics = {m.get("id"): m for m in ((cj.get("reportedMetrics") or {}).get("metrics") or [])}
    full_text_read = (cj.get("reportedMetrics") or {}).get("fullTextRead", False)

    # The repository the site shows: the workbook's link, else a link verified in the text,
    # else nothing. The accessibility cache is keyed by that URL.
    repo_url = (cj_repo.get("url") or c.get("repo_oshw_link") or "").strip()
    ra = repometa.get(repo_url, {}) if repo_url else {}

    pdf = file_for(title, pdf_files)
    md = file_for(title, md_files)
    supp_rows = supp_by_title.get(norm_title(title), [])
    supp = [r["file"].replace("pdfs/supplementary/", "") for r in supp_rows]

    def metric_cell(mid):
        m = cj_metrics.get(mid)
        if not full_text_read:
            return "n/a (full text not held)"
        if not m or m.get("status") != "yes":
            return "not reported"
        return m.get("value") or "reported"

    row = {
        # --- identity ---
        "assessment_index": (a.get("index") or "").strip(),
        "title": title,
        "doi": c.get("doi", ""),
        "primary_link": c.get("primary_link", ""),
        "year": c.get("year", ""),
        "venue": c.get("venue", ""),
        "category": c.get("category", ""),
        "technology_type": a.get("technology_type", ""),
        "system_or_technology": c.get("system_or_technology", ""),
        "modality": c.get("modality", ""),
        "keep": (a.get("Keep reference (yes or no)") or "").strip(),
        # --- curated description ---
        "what_is_open_sourced": c.get("what_is_open_sourced", ""),
        "why_it_matters": c.get("why_it_matters", ""),
        "function": c.get("function", ""),
        "main_advantage": c.get("main_advantage", ""),
        "key_performance_metric": c.get("key_performance_metric", ""),
        "scale_throughput": c.get("scale_throughput", ""),
        "material_reagent_compatibility": c.get("material_reagent_compatibility", ""),
        "open_source_resources": c.get("open_source_resources", ""),
        "limitation_curated": c.get("limitation", ""),
        # --- cost / effort, curated then assessment ---
        "cost_curated": c.get("approximate_cost_or_cost_usd", ""),
        "cost_assessment": (a.get("Approximate Total Build Cost (USD)") or "").strip(),
        "build_time_curated": c.get("build_time", ""),
        "build_complexity_curated": c.get("build_complexity", ""),
        "technical_skills_curated": c.get("technical_skills_needed", ""),
        "low_cost": c.get("low_cost", ""),
        "easy_to_build": c.get("easy_to_build", ""),
        "easy_to_use": c.get("easy_to_use", ""),
        "open_source": c.get("open_source", ""),
        # --- NEW: mined from the paper full text ---
        "ft_license": ft.get("licence", ""),
        "ft_license_scope": ft.get("licence_scope", ""),
        "ft_license_evidence": ft.get("licence_evidence", ""),
        "ft_repo_links": ft.get("repo_links", ""),
        "ft_dependency_links": ft.get("dependency_links", ""),
        "ft_cost": ft.get("cost", ""),
        "ft_cost_evidence": ft.get("cost_evidence", ""),
        "ft_build_time": ft.get("build_time", ""),
        "ft_build_time_evidence": ft.get("build_time_evidence", ""),
        "ft_skills_evidence": ft.get("skills_evidence", ""),
        "ft_limitation_evidence": ft.get("limitation_evidence", ""),
        "ft_limitation_evidence_2": ft.get("limitation_evidence_2", ""),
        # --- the corpus as published: every curated layer already applied ---
        "corpus_slug": cj.get("slug", ""),
        "corpus_repo_url": cj_repo.get("url", ""),
        "corpus_repo_provenance": cj_repo.get("provenance", ""),
        "corpus_repo_state": cj_access.get("maintenance", "") if cj_repo else "none",
        "corpus_licence": cj_licence.get("value", ""),
        "corpus_licence_source": cj_licence.get("source", ""),
        "corpus_cost": cj.get("approximateCost", ""),
        "corpus_cost_source": cj.get("approximateCostSource", ""),
        "corpus_files": " | ".join(cj.get("assetTypes") or []),
        # The site's "Ease": mean of the criteria it shows (the two withheld ones excluded).
        "corpus_ease_average": (cj.get("criteriaAssessment") or {}).get("averageScore", ""),
        "corpus_ease_criteria_count": (cj.get("criteriaAssessment") or {}).get("displayedCriteriaCount", ""),
        "corpus_skill_level": (cj.get("derived") or {}).get("skillLevel", ""),
        "corpus_documentation_tier": (cj.get("derived") or {}).get("documentationTier", ""),
        "reported_count": (cj.get("reportedMetrics") or {}).get("reportedCount", "") if full_text_read else "",
        "metric_motion_accuracy": metric_cell("motion-accuracy"),
        "metric_volumetric_accuracy": metric_cell("volumetric-accuracy"),
        "metric_cell_viability": metric_cell("cell-viability"),
        "metric_unattended_operation": metric_cell("unattended-operation"),
        "metric_standard_compliance": metric_cell("standard-compliance"),
        # --- repo accessibility check, on the repository the corpus shows ---
        "repo_url": repo_url,
        "repo_accessible": "" if not ra else ("yes" if ra.get("accessible") else "no"),
        "repo_last_activity": (ra.get("lastActivity") or "")[:10],
        "repo_archived": "yes" if ra.get("archived") else ("no" if ra else ""),
        "repo_license_api": ra.get("license", ""),
        "repo_checked_at": (ra.get("checkedAt") or "")[:10],
        # --- NEW: publication metadata ---
        "oa_is_open_access": "yes" if ((oa.get("openAccess") or {}).get("isOpen")) else ("no" if oa else ""),
        "oa_status": (oa.get("openAccess") or {}).get("status", "") if oa else "",
        "oa_is_retracted": "yes" if oa.get("isRetracted") else ("no" if oa else ""),
        "oa_cited_by": oa.get("citedByCount", "") if oa else "",
        "oa_publication_date": oa.get("publicationDate", "") if oa else "",
        # --- NEW: what full text we hold ---
        "has_pdf": "yes" if pdf else "no",
        "pdf_file": pdf,
        "has_markdown": "yes" if md else "no",
        "supplementary_count": len(supp),
        "supplementary_files": " | ".join(supp),
        "supplementary_notes": " | ".join(r.get("what", "") for r in supp_rows),
        # --- provenance ---
        "source_workbooks": c.get("source_workbooks", ""),
    }

    # rubric scores
    for name in CRITERIA:
        row[f"score_{name}"] = (a.get(f"{name} value") or "").strip()
    vals = [row[f"score_{n}"] for n in CRITERIA]
    nums = [int(v) for v in vals if v.isdigit()]
    # Mean of every scored criterion, all ten. The site shows corpus_ease_average instead,
    # which leaves out Application Level and Build Time; the two agree only by chance.
    row["score_average_all_criteria"] = round(sum(nums) / len(nums), 2) if nums else ""

    rows_out.append(row)

rows_out.sort(key=lambda r: (r["category"], r["title"]))

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
    w.writeheader()
    w.writerows(rows_out)

n = len(rows_out)
print(f"wrote {n} rows x {len(rows_out[0])} columns -> {OUT}\n")


def filled(field):
    return sum(1 for r in rows_out if str(r.get(field, "")).strip())


print("coverage of the columns that were thin before:")
for label, fields in [
    ("licence shown by the site", ["corpus_licence"]),
    ("licence (any source)", ["corpus_licence", "ft_license", "repo_license_api"]),
    ("repository shown by the site", ["corpus_repo_url"]),
    ("repo link (any source)", ["repo_url", "ft_repo_links"]),
    ("cost shown by the site", ["corpus_cost"]),
    ("cost (any source)", ["cost_curated", "cost_assessment", "ft_cost"]),
    ("design files shown by the site", ["corpus_files"]),
    ("supplementary files held", ["supplementary_files"]),
    ("build time (any source)", ["build_time_curated", "ft_build_time"]),
    ("limitation (any source)", ["limitation_curated", "ft_limitation_evidence"]),
    ("skills (any source)", ["technical_skills_curated", "ft_skills_evidence"]),
]:
    c = sum(1 for r in rows_out if any(str(r.get(f, "")).strip() for f in fields))
    print(f"  {c:3d}/{n} ({100*c/n:5.1f}%)  {label}")
