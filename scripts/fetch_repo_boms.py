#!/usr/bin/env python3
"""Find and download bill-of-materials files from the repositories papers link to.

Papers usually publish only a total cost; the line-by-line BOM lives in the linked
repository. This walks the GitHub / OSF / Zenodo / Mendeley links we hold, looks for
files that look like a BOM, and downloads them to pdfs/repo_boms/.

Read-only against public APIs. Set GITHUB_TOKEN for a higher rate limit.
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
OUT_DIR = os.path.join(REPO, "pdfs", "repo_boms")
INDEX = os.path.join(REPO, "lists", "derived", "repo_bom_index.csv")
UA = "DIY-Biofabrication-Atlas/1.0 (BOM discovery; mailto:organmimicry@accelerationconsortium.ai)"
TOKEN = os.environ.get("GITHUB_TOKEN", "")

# A file is worth downloading if its name suggests a parts list or costing sheet.
BOM_NAME = re.compile(
    r"(bom|bill[_\s-]?of[_\s-]?materials|parts?[_\s-]?list|components?[_\s-]?list|"
    r"shopping[_\s-]?list|cost|price|budget|materials)", re.I)
BOM_EXT = (".xlsx", ".xls", ".csv", ".ods", ".pdf", ".md", ".txt", ".tsv")
SKIP_DIR = re.compile(r"(node_modules|\.git|__pycache__|\.github/workflows|tests?/|fixtures?/|"
                      r"testdata|functional/|regrtest)", re.I)

# In software repos "BOM" means byte order mark, not bill of materials. Without this a
# scan of a Python project happily downloads its UTF-16/32 encoding fixtures.
NOT_A_BOM = re.compile(r"(byte[_\s-]?order|utf[_\s-]?(?:8|16|32)|bidirectional|encoding|"
                       r"\bsbom\b|package-lock|yarn\.lock)", re.I)

# Repos belonging to third-party tools, not the paper's own design files.
DEPENDENCY_REPO = re.compile(
    r"github\.com/(?:pylint-dev|psf|python|pytest-dev|numpy|scipy|pandas-dev|matplotlib|"
    r"Ultimaker|slic3r|prusa3d|MarlinFirmware|arduino|espressif|raspberrypi|opencv|"
    r"facebookresearch|pytorch|tensorflow|scikit-learn|uArm-Developer)\b", re.I)


def get(url, headers=None, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url, headers=None):
    return json.loads(get(url, headers))


def gh_headers():
    h = {"Accept": "application/vnd.github+json"}
    if TOKEN:
        h["Authorization"] = f"Bearer {TOKEN}"
    return h


def github_candidates(url):
    """List files in a GitHub repo tree whose names look like a BOM."""
    m = re.match(r"https?://(?:www\.)?github\.com/([^/]+)/([^/]+)", url)
    if not m:
        return []
    owner, repo = m.group(1), m.group(2).replace(".git", "")
    if DEPENDENCY_REPO.search(url):
        print(f"    skipped dependency repo: {owner}/{repo}")
        return []
    try:
        info = get_json(f"https://api.github.com/repos/{owner}/{repo}", gh_headers())
        branch = info.get("default_branch", "main")
        tree = get_json(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
            gh_headers())
    except Exception as e:
        print(f"    github error {owner}/{repo}: {e}")
        return []
    out = []
    for node in tree.get("tree", []):
        if node.get("type") != "blob":
            continue
        path = node["path"]
        if SKIP_DIR.search(path):
            continue
        name = path.rsplit("/", 1)[-1]
        if BOM_NAME.search(name) and name.lower().endswith(BOM_EXT) and not NOT_A_BOM.search(path):
            out.append({
                "name": name,
                "path": path,
                "size": node.get("size", 0),
                "download": f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/"
                            + urllib.parse.quote(path),
            })
    return out


def osf_candidates(url):
    """Walk an OSF project's files via its public API."""
    m = re.search(r"osf\.io/([a-z0-9]{5})", url, re.I)
    if not m:
        return []
    node = m.group(1).lower()
    out = []
    try:
        provs = get_json(f"https://api.osf.io/v2/nodes/{node}/files/")
        for prov in provs.get("data", []):
            link = prov["relationships"]["files"]["links"]["related"]["href"]
            stack = [link]
            seen = 0
            while stack and seen < 12:
                seen += 1
                try:
                    page = get_json(stack.pop())
                except Exception:
                    continue
                for f in page.get("data", []):
                    attrs = f.get("attributes", {})
                    if attrs.get("kind") == "folder":
                        nxt = f["relationships"]["files"]["links"]["related"]["href"]
                        stack.append(nxt)
                        continue
                    name = attrs.get("name", "")
                    if BOM_NAME.search(name) and name.lower().endswith(BOM_EXT) \
                            and not NOT_A_BOM.search(name):
                        out.append({
                            "name": name,
                            "path": attrs.get("materialized_path", name),
                            "size": attrs.get("size", 0),
                            "download": f["links"].get("download", ""),
                        })
    except Exception as e:
        print(f"    osf error {node}: {e}")
    return out


def mendeley_candidates(url):
    """Mendeley Data datasets expose their file list through a public endpoint."""
    m = re.search(r"data\.mendeley\.com/datasets/([a-z0-9]+)(?:/(\d+))?", url, re.I)
    if not m:
        return []
    ds, ver = m.group(1), m.group(2) or "1"
    try:
        data = get_json(f"https://data.mendeley.com/public-api/datasets/{ds}/files?folder_id=root&version={ver}")
    except Exception as e:
        print(f"    mendeley error {ds}: {e}")
        return []
    out = []
    for f in data if isinstance(data, list) else data.get("results", []):
        name = f.get("filename") or f.get("name", "")
        link = (f.get("content_details") or {}).get("download_url") or f.get("download_url", "")
        if name and BOM_NAME.search(name) and name.lower().endswith(BOM_EXT):
            out.append({"name": name, "path": name,
                        "size": (f.get("content_details") or {}).get("size", 0),
                        "download": link})
    return out


def collect_links():
    path = os.path.join(REPO, "lists", "derived", "master_table.csv")
    links = {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        urls = []
        if r.get("repo_url"):
            urls.append(r["repo_url"].strip())
        for u in (r.get("ft_repo_links") or "").split("|"):
            if u.strip():
                urls.append(u.strip())
        for u in urls:
            links.setdefault(u, r["title"])
    return links


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    links = collect_links()
    rows = []
    for url, paper in sorted(links.items(), key=lambda kv: kv[1]):
        low = url.lower()
        if "github.com" in low:
            cands = github_candidates(url)
        elif "osf.io" in low:
            cands = osf_candidates(url)
        elif "data.mendeley.com" in low:
            cands = mendeley_candidates(url)
        else:
            continue  # thingiverse / nih3d / project sites have no stable public file API
        if not cands:
            continue
        print(f"  {paper[:46]:48s} {len(cands)} candidate(s)  {url[:46]}")
        for c in cands[:4]:
            safe = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{paper[:48]}__{c['name']}")
            dest = os.path.join(OUT_DIR, safe)
            status = "cached"
            if not os.path.exists(dest):
                try:
                    blob = get(c["download"])
                    with open(dest, "wb") as fh:
                        fh.write(blob)
                    status = "downloaded"
                    time.sleep(0.4)
                except Exception as e:
                    status = f"failed: {e}"
            print(f"       [{status}] {c['name'][:52]}")
            rows.append({"paper": paper, "repo_url": url, "file": c["name"],
                         "repo_path": c["path"], "size": c["size"],
                         "local_file": os.path.basename(dest) if status != "cached" or os.path.exists(dest) else "",
                         "status": status})

    if rows:
        os.makedirs(os.path.dirname(INDEX), exist_ok=True)
        with open(INDEX, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    ok = sum(1 for r in rows if r["status"] in ("downloaded", "cached"))
    print(f"\n{ok} BOM-like files from {len(set(r['paper'] for r in rows))} papers -> {OUT_DIR}")
    if rows:
        print(f"index -> {INDEX}")


if __name__ == "__main__":
    main()
