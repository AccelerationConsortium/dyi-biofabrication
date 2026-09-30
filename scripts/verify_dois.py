#!/usr/bin/env python3
"""Verify every corpus entry has a DOI that resolves to the right paper.

"Verified" here means more than holding a DOI-shaped string: the DOI must resolve at
Crossref (articles) or DataCite (datasets and OSF/Zenodo deposits), and the title it
returns must match the title we record. A DOI that resolves to a different paper is
worse than a missing one, so mismatches are reported separately rather than counted.

Where no DOI is recorded, it tries in order: a DOI embedded in the link, a PMC id
resolved through the NCBI converter, a publisher URL pattern, and finally the local
OpenAlex/Crossref enrichment cache.

Writes lists/derived/doi_verification.csv.
"""
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "lists", "derived", "doi_verification.csv")
MAIL = "organmimicry@accelerationconsortium.ai"
UA = f"DIY-Biofabrication-Atlas/1.0 (DOI verification; mailto:{MAIL})"


def norm_doi(s):
    s = str(s or "").strip().lower()
    s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s)
    m = re.search(r"10\.\d{4,9}/[^\s\"'<>]+", s)
    return m.group(0).rstrip(".,;)") if m else ""


def norm_title(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", str(s or "").lower())).strip()


def title_match(a, b):
    ta = set(w for w in norm_title(a).split() if len(w) > 3)
    tb = set(w for w in norm_title(b).split() if len(w) > 3)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def doi_from_pmc(link):
    m = re.search(r"(PMC\d+)", link, re.I)
    if not m:
        return ""
    try:
        d = fetch("https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids="
                  f"{m.group(1)}&format=json")
        recs = d.get("records") or []
        return norm_doi(recs[0].get("doi", "")) if recs else ""
    except Exception:
        return ""


def doi_from_publisher_url(link):
    """Several publishers encode the DOI suffix directly in the article URL."""
    patterns = [
        (r"nature\.com/articles/([a-z0-9-]+)", "10.1038/{}"),
        (r"mdpi\.com/(\d{4}-\d{3,4}[\dxX])/(\d+)/(\d+)/(\d+)", None),   # needs journal map
        (r"sciencedirect\.com/science/article/pii/(S\w+)", None),        # PII, not a DOI
    ]
    for pattern, template in patterns:
        m = re.search(pattern, link, re.I)
        if m and template:
            return norm_doi(template.format(m.group(1)))
    return ""


def crossref(doi):
    try:
        d = fetch(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}?mailto={MAIL}")
        msg = d["message"]
        title = (msg.get("title") or [""])[0]
        year = (msg.get("issued", {}).get("date-parts", [[None]])[0] or [None])[0]
        return {"agency": "Crossref", "title": title, "year": year,
                "type": msg.get("type", ""), "ok": True}
    except Exception:
        return None


def datacite(doi):
    try:
        d = fetch(f"https://api.datacite.org/dois/{urllib.parse.quote(doi)}")
        a = d["data"]["attributes"]
        titles = a.get("titles") or [{}]
        return {"agency": "DataCite", "title": titles[0].get("title", ""),
                "year": a.get("publicationYear"), "type": (a.get("types") or {}).get("resourceTypeGeneral", ""),
                "ok": True}
    except Exception:
        return None


def registry_prefix(recorded, registered):
    """True when either title is a leading substring of the other, ignoring punctuation.

    A registry short form is a prefix of the full title, not an unrelated string, so this
    stays strict: it will not accept two titles that merely share an opening phrase and then
    diverge, because the shorter must run out exactly where it stops.
    """
    def flat(v):
        return re.sub(r"[^a-z0-9]+", "", (v or "").lower())
    a, b = flat(recorded), flat(registered)
    if not a or not b:
        return False
    short, long = sorted((a, b), key=len)
    return len(short) >= 6 and long.startswith(short)


def main():
    master = os.path.join(REPO, "lists", "derived", "master_table.csv")
    rows = list(csv.DictReader(open(master, encoding="utf-8")))

    cache_path = os.path.join(REPO, "site", "src", "data", "enrichment", "publication_metadata.json")
    cache = json.load(open(cache_path, encoding="utf-8")).get("records", {}) if os.path.exists(cache_path) else {}
    cache_by_title = {}
    for v in cache.values():
        d = norm_doi(v.get("resolvedDoi") or v.get("requestedDoi"))
        for t in (v.get("paperTitle"), (v.get("openAlex") or {}).get("title")):
            if t and d:
                cache_by_title.setdefault(norm_title(t), (d, v.get("matchMethod", "")))

    out = []
    for r in rows:
        title = r["title"]
        doi, source = norm_doi(r["doi"]), "recorded"
        if not doi:
            doi, source = norm_doi(r["primary_link"]), "link"
        if not doi:
            doi = doi_from_pmc(r["primary_link"])
            source = "pmc id converter" if doi else source
        if not doi:
            doi = doi_from_publisher_url(r["primary_link"])
            source = "publisher url" if doi else source
        if not doi:
            hit = cache_by_title.get(norm_title(title))
            if hit:
                doi, source = hit[0], f"enrichment cache ({hit[1]})"

        rec = {"title": title, "doi": doi, "doi_source": source if doi else "",
               "resolves": "", "agency": "", "registered_title": "",
               "title_similarity": "", "verdict": ""}

        if not doi:
            rec["verdict"] = "NO DOI FOUND"
        else:
            meta = crossref(doi) or datacite(doi)
            time.sleep(0.25)
            if not meta:
                rec.update(resolves="no", verdict="DOES NOT RESOLVE")
            else:
                sim = title_match(title, meta["title"])
                rec.update(resolves="yes", agency=meta["agency"],
                           registered_title=(meta["title"] or "")[:110],
                           title_similarity=round(sim, 2))
                # Some registries store a short form of the title -- ACM registered
                # "OpenLH" for a paper called "OpenLH: Open Liquid-Handling System for
                # Creative Experimentation with Biology". Token overlap scores that 0.11 and
                # calls it a mismatch, when the DOI is correct and the registry is simply
                # terse. Treat one title being a prefix of the other as confirmation.
                if sim >= 0.5:
                    rec["verdict"] = "VERIFIED"
                elif registry_prefix(title, meta["title"]):
                    rec["verdict"] = "VERIFIED (registry stores a short title)"
                elif sim >= 0.25:
                    rec["verdict"] = "CHECK (partial title match)"
                else:
                    rec["verdict"] = "MISMATCH"
        out.append(rec)
        print(f"  {rec['verdict']:28s} {title[:52]}")

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    n = len(out)
    import collections
    tally = collections.Counter(r["verdict"] for r in out)
    print(f"\n{n} entries -> {OUT}")
    for verdict, c in tally.most_common():
        print(f"  {c:3d}/{n} ({100*c/n:5.1f}%)  {verdict}")


if __name__ == "__main__":
    main()
