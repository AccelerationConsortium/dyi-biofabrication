#!/usr/bin/env python3
"""Per paper, record whether each performance requirement is reported with a number.

Three states, and the difference between the last two matters:
  yes - a numeric value was found, with the sentence it came from
  no  - we hold the full text, searched it, and found no reported value
  na  - we do not hold the full text, so the question cannot be answered

Reporting "no" for a paper we never read would be a claim we cannot support, so the
absence of a PDF always yields "na".

A mention alone is not enough for "yes": the sentence must carry a number in a unit
that fits the requirement. "The system is accurate" is not a reported accuracy.

Writes lists/derived/reported_metrics.csv.
"""
import csv
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(REPO, "pdfs", "markdown")
OUT = os.path.join(REPO, "lists", "derived", "reported_metrics.csv")

NUM = r"\d+(?:[.,]\d+)?"

REQUIREMENTS = [
    {
        "key": "motion_accuracy",
        "label": "Motion / positional accuracy",
        "context": r"(travel accuracy|positional accuracy|positioning accuracy|repeatabilit|"
                   r"backlash|step resolution|motion accuracy|accuracy of the (?:stage|axis|gantry))",
        "value": rf"(?:±\s*)?{NUM}\s*(?:µ|μ|u)m|(?:±\s*)?{NUM}\s*mm\b",
    },
    {
        "key": "volumetric_accuracy",
        "label": "Volumetric accuracy",
        "context": r"(volumetric (?:accuracy|error)|random error|systematic error|"
                   r"coefficient of variation|\bCV\b|dispensing accuracy|pipetting accuracy|ISO\s?8655)",
        "value": rf"{NUM}\s*%|{NUM}\s*(?:µ|μ|u)L|{NUM}\s*mL",
    },
    {
        "key": "cell_viability",
        "label": "Cell viability",
        "context": r"(viabilit|live/dead|live-dead|cytotoxic)",
        "value": rf"{NUM}\s*%",
    },
    {
        "key": "unattended_operation",
        "label": "Unattended operation",
        # Deliberately strict: an API or "automated workflow" is not evidence that a run
        # completed without a person present.
        "context": r"(unattended|walk[- ]?away|without (?:human |operator |manual )?(?:intervention|supervision)|"
                   r"continuous(?:ly)? (?:operat|run)|overnight run|autonomous(?:ly)? (?:operat|run))",
        "value": rf"{NUM}\s*(?:h|hours?|days?|min|minutes?|cycles?|runs?|samples?|plates?)\b|unattended|walk[- ]?away",
    },
    {
        "key": "standard_compliance",
        "label": "Reported against a written standard",
        "context": r"(ISO\s?\d{3,5}|ASTM\s?[A-Z]?\d+|ANSI[/ ]?SLAS|SLAS\s?\d|DIN\s?\d+|IEC\s?\d+)",
        "value": r"ISO\s?\d{3,5}|ASTM\s?[A-Z]?\d+|ANSI[/ ]?SLAS|SLAS\s?\d|DIN\s?\d+|IEC\s?\d+",
    },
]


def sentences(text):
    text = re.sub(r"\s+", " ", text)
    return re.split(r"(?<=[.!?])\s+(?=[A-Z(])", text)


def tidy(s, limit=240):
    return re.sub(r"\s+", " ", s).strip()[:limit]


def is_prose(s, lenient=False):
    """Reject table wreckage from the PDF conversion.

    Converted tables arrive as runs of pipes, stray digits and words glued together
    ("Est.3Dprintingcostfor PLAparts"). A number pulled from one of those is not a
    reported result -- the cost column of a BOM can easily look like an accuracy.
    """
    if s.count("|") > 2:
        return False
    letters = sum(c.isalpha() for c in s)
    if letters < (12 if lenient else 40) or letters / max(len(s), 1) < (0.4 if lenient else 0.55):
        return False
    words = s.split()
    if not words:
        return False
    # a long token with no internal spaces is a sign of collapsed table text
    if max(len(w) for w in words) > 28:
        return False
    # real sentences are mostly words, not isolated numbers
    numeric = sum(1 for w in words if re.fullmatch(r"[\d.,%±-]+", w))
    return numeric / len(words) < 0.35


def assess(text, req, lenient=False):
    """Return (status, value, evidence) for one requirement against one paper's text."""
    ctx = re.compile(req["context"], re.I)
    val = re.compile(req["value"], re.I)
    best = None
    for s in sentences(text):
        if not ctx.search(s) or not is_prose(s, lenient):
            continue
        m = val.search(s)
        if m:
            # prefer a short, number-bearing sentence: more likely the actual result
            score = len(s)
            if best is None or score < best[0]:
                best = (score, m.group(0).strip(), tidy(s))
    if best:
        return "yes", best[1], best[2]
    return "no", "", ""


def main():
    master = os.path.join(REPO, "lists", "derived", "master_table.csv")
    rows = list(csv.DictReader(open(master, encoding="utf-8")))

    fields = ["title", "doi", "has_fulltext"]
    for r in REQUIREMENTS:
        fields += [f"{r['key']}", f"{r['key']}_value", f"{r['key']}_evidence"]

    out = []
    for r in rows:
        md_name = r["pdf_file"].replace(".pdf", ".md") if r["pdf_file"] else ""
        path = os.path.join(MD, md_name) if md_name else ""
        have = bool(path and os.path.exists(path))
        rec = {"title": r["title"], "doi": r["doi"], "has_fulltext": "yes" if have else "no"}
        text = open(path, encoding="utf-8", errors="ignore").read() if have else ""
        # The curated key_performance_metric is hand-written and reliable, unlike the
        # PDF conversion. Check it first so a badly converted paper is not recorded as
        # "not reported" when a curator already captured the figure.
        curated = r.get("key_performance_metric", "")
        for req in REQUIREMENTS:
            status, value, evidence = "na", "", ""
            if curated:
                cstatus, cvalue, cevidence = assess(curated, req, lenient=True)
                if cstatus == "yes":
                    status, value, evidence = "yes", cvalue, f"[curated metric] {cevidence}"
            if status != "yes" and have:
                status, value, evidence = assess(text, req)
            elif status != "yes" and not have:
                status = "na"   # no text and nothing curated: unanswered
            rec[req["key"]] = status
            rec[f"{req['key']}_value"] = value
            rec[f"{req['key']}_evidence"] = evidence
        out.append(rec)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(out)

    n = len(out)
    held = sum(1 for r in out if r["has_fulltext"] == "yes")
    print(f"{n} papers ({held} with full text) -> {OUT}\n")
    print(f"{'requirement':34s} {'yes':>5s} {'no':>5s} {'na':>5s}   yes as % of papers read")
    print("-" * 82)
    for req in REQUIREMENTS:
        y = sum(1 for r in out if r[req["key"]] == "yes")
        no = sum(1 for r in out if r[req["key"]] == "no")
        na = sum(1 for r in out if r[req["key"]] == "na")
        pct = (100 * y / held) if held else 0
        print(f"{req['label']:34s} {y:5d} {no:5d} {na:5d}   {pct:5.1f}%")


if __name__ == "__main__":
    main()
