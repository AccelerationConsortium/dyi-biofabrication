#!/usr/bin/env python3
"""Extract atlas fields from paper full text converted to Markdown.

Reads pdfs/markdown/*.md (produced by markitdown) and pulls out the fields the
curated workbooks leave thin: repository links, licences, build cost, build time,
required skills, and reported limitations.

Every value is emitted with the sentence it came from, so a reviewer can check it
against the source rather than trusting a heuristic. Nothing here writes to the
corpus -- it produces lists/derived/fulltext_extraction.csv for review.
"""
import csv
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD_DIR = os.path.join(REPO, "pdfs", "markdown")
OUT = os.path.join(REPO, "lists", "derived", "fulltext_extraction.csv")

# Repository / design-file hosts worth linking from an atlas record.
REPO_HOSTS = [
    "github.com", "gitlab.com", "bitbucket.org", "gitee.com", "sourceforge.net",
    "osf.io", "zenodo.org", "figshare.com", "data.mendeley.com", "dataverse",
    "thingiverse.com", "printables.com", "hackaday.io", "docs.google.com/spreadsheets",
    "nih3d.nih.gov", "3dprint.nih.gov", "protocols.io", "appropedia.org",
]

# Licences that describe the *artifact* (hardware/software), not the article.
ARTIFACT_LICENCES = [
    (r"\bCERN[- ]OHL(?:[- ]?[SWP])?(?:[- ]?v?\d(?:\.\d)?)?\b", "CERN-OHL"),
    (r"\bMIT License\b|\bMIT licen[cs]e\b", "MIT"),
    (r"\bGNU General Public License\b|\bGPL(?:[- ]?v?[23](?:\.0)?)?\b", "GPL"),
    (r"\bLGPL\b", "LGPL"),
    (r"\bApache License\b|\bApache[- ]2\.0\b", "Apache-2.0"),
    (r"\bBSD[- ](?:2|3)[- ]Clause\b|\bBSD licen[cs]e\b", "BSD"),
    (r"\bTAPR Open Hardware License\b|\bTAPR OHL\b", "TAPR-OHL"),
    (r"\bSolderpad\b", "Solderpad"),
    (r"\bCreative Commons Attribution[- ]ShareAlike\b|\bCC[- ]BY[- ]SA\b", "CC-BY-SA"),
    (r"\bCC0\b|\bpublic domain dedication\b", "CC0"),
    (r"\bCC[- ]BY[- ]NC(?:[- ]SA)?\b", "CC-BY-NC"),
    (r"\bCreative Commons Attribution\b|\bCC[- ]BY\b", "CC-BY"),
]

COST_NEAR = r"(?:cost|price|bom|bill of materials|budget|usd|eur|gbp|\$|€|£)"
MONEY = r"(?:[\$€£]\s?\d[\d,.]*(?:\s?(?:k|thousand|million))?|\d[\d,.]*\s?(?:USD|EUR|GBP|dollars|euros))"

BUILD_TIME = r"\b\d+(?:\.\d+)?\s*(?:-\s*\d+\s*)?(?:hours?|hrs?|days?|weeks?|minutes?|min)\b"
BUILD_TIME_NEAR = r"(?:assembl|build|construct|print time|printing time|fabricat|setup|set-up)"

SKILL_NEAR = (r"(?:requires?|required|necessary|expertise|experience|skills?|proficien|"
              r"familiar(?:ity)? with|knowledge of|training)")

LIMIT_NEAR = (r"(?:limitation|limited to|is limited|are limited|drawback|shortcoming|"
              r"cannot|could not|does not support|not suitable|constrain|trade-?off)")


# PDFs use non-breaking/en/em dashes inside licence names ("CC BY‑SA"), which would
# otherwise defeat the patterns below and silently downgrade CC-BY-SA to CC-BY.
DASHES = dict.fromkeys(map(ord, "‐‑‒–—−"), "-")


def normalize_dashes(text):
    return text.translate(DASHES)


def sentences(text):
    text = re.sub(r"\s+", " ", normalize_dashes(text))
    return re.split(r"(?<=[.!?])\s+(?=[A-Z(])", text)


def snippet(s, limit=260):
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit]


# Repos belonging to third-party tools a paper merely *uses* (slicers, firmware, libraries).
# Crediting these as the paper's own design files would be wrong.
DEPENDENCY_PATTERNS = [
    r"github\.com/(?:Ultimaker|slic3r|prusa3d|MarlinFirmware|makerbase-mks|arduino|"
    r"facebookresearch|opencv|numpy|scipy|pytorch|tensorflow|micropython|espressif|"
    r"raspberrypi|uArm-Developer|Klipper3d|matplotlib|scikit-learn)\b",
    r"github\.com/[^/]+/(?:Cura|Slic3r|Marlin|OctoPrint|opentrons|detectron2)\b",
]

# PDF text extraction drops spaces, gluing following words onto a URL.
GLUE_TAIL = re.compile(
    r"(?:\(?accessedon.*|andat.*|andthe.*|whichis.*|seehttp.*|Accessed.*)$", re.I
)


def clean_url(u):
    u = u.rstrip(".,;:'\")")
    u = re.split(r"[#?]", u)[0]
    u = GLUE_TAIL.sub("", u)
    return u.rstrip("/.,;:")


def classify_url(u):
    for pattern in DEPENDENCY_PATTERNS:
        if re.search(pattern, u, re.I):
            return "dependency"
    return "project"


def find_urls(text):
    raw = re.findall(r"https?://[^\s\)\]\}<>\"',;]+", text)
    project, dependency = [], []
    for u in raw:
        if not any(h in u.lower() for h in REPO_HOSTS):
            continue
        u = clean_url(u)
        # a bare host with no path tells us nothing
        rest = re.sub(r"^https?://", "", u)
        if "/" not in rest.rstrip("/") or len(rest.split("/", 1)[1]) < 2:
            continue
        bucket = dependency if classify_url(u) == "dependency" else project
        if u not in bucket:
            bucket.append(u)
    return project, dependency


# HardwareX and similar hardware journals carry an explicit licence row in their
# specifications table. That row is about the hardware, so it beats any prose guess --
# but the table's column layout survives PDF extraction unevenly, so only accept a
# value that actually looks like a licence rather than the next label in the table.
SPEC_LICENCE_LABEL = re.compile(
    r"(?:Hardware|Open[- ]?source|Software)\s+licen[cs]e\s*[:|]?\s*(.{0,60})", re.I
)


def find_spec_licence(text):
    flat = re.sub(r"\s+", " ", normalize_dashes(text))
    for m in SPEC_LICENCE_LABEL.finditer(flat):
        window = m.group(1)
        for pattern, name in ARTIFACT_LICENCES:
            hit = re.search(pattern, window, re.I)
            if hit:
                return name, snippet(hit.group(0) + " — " + window, 90)
    return "", ""


def find_licences(sents):
    hits = []
    for s in sents:
        for pattern, name in ARTIFACT_LICENCES:
            if re.search(pattern, s, re.I):
                # A publisher boilerplate sentence describes the article, not the hardware.
                article = bool(re.search(r"open access article|distributed under the terms|"
                                         r"licensee|©|copyright \d{4}|this article is", s, re.I))
                hits.append((name, "article" if article else "artifact", snippet(s)))
                break
    # prefer artifact-scoped evidence
    hits.sort(key=lambda h: h[1] != "artifact")
    return hits


def find_near(sents, value_pattern, context_pattern, max_hits=3):
    out = []
    for s in sents:
        if not re.search(context_pattern, s, re.I):
            continue
        for m in re.finditer(value_pattern, s, re.I):
            out.append((m.group(0).strip(), snippet(s)))
            if len(out) >= max_hits:
                return out
    return out


def find_sentences(sents, pattern, max_hits=3):
    out = []
    for s in sents:
        if re.search(pattern, s, re.I) and len(s.split()) >= 6:
            out.append(snippet(s, 300))
            if len(out) >= max_hits:
                break
    return out


def main():
    if not os.path.isdir(MD_DIR):
        sys.exit(f"no markdown directory at {MD_DIR}")
    files = sorted(f for f in os.listdir(MD_DIR) if f.endswith(".md"))
    if not files:
        sys.exit("no markdown files to read")

    rows = []
    for name in files:
        path = os.path.join(MD_DIR, name)
        text = open(path, encoding="utf-8", errors="ignore").read()
        sents = sentences(text)
        title = re.sub(r"^\d+_", "", name[:-3]).replace("_", " ")

        urls, dep_urls = find_urls(text)
        lic = find_licences(sents)
        spec_lic, spec_lic_evidence = find_spec_licence(text)
        cost = find_near(sents, MONEY, COST_NEAR)
        btime = find_near(sents, BUILD_TIME, BUILD_TIME_NEAR)
        skills = find_sentences(sents, SKILL_NEAR, 2)
        limits = find_sentences(sents, LIMIT_NEAR, 3)

        rows.append({
            "file": name,
            "title_from_filename": title,
            "repo_links": " | ".join(urls[:6]),
            "repo_link_count": len(urls),
            "dependency_links": " | ".join(dep_urls[:4]),
            # The specifications-table row is authoritative for the hardware when present.
            "licence": spec_lic or (lic[0][0] if lic else ""),
            "licence_scope": "artifact (spec table)" if spec_lic else (lic[0][1] if lic else ""),
            "licence_evidence": spec_lic_evidence or (lic[0][2] if lic else ""),
            "cost": cost[0][0] if cost else "",
            "cost_evidence": cost[0][1] if cost else "",
            "build_time": btime[0][0] if btime else "",
            "build_time_evidence": btime[0][1] if btime else "",
            "skills_evidence": skills[0] if skills else "",
            "limitation_evidence": limits[0] if limits else "",
            "limitation_evidence_2": limits[1] if len(limits) > 1 else "",
            "chars": len(text),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    n = len(rows)
    def got(field):
        return sum(1 for r in rows if str(r[field]).strip())
    print(f"read {n} markdown files -> {OUT}\n")
    for field in ("repo_links", "licence", "cost", "build_time",
                  "skills_evidence", "limitation_evidence"):
        c = got(field)
        print(f"  {c:3d}/{n} ({100*c/n:5.1f}%)  {field}")


if __name__ == "__main__":
    main()
