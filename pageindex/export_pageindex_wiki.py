#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value: str, limit: int = 120) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"[\"'`]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text[:limit]


def note_name(value: str) -> str:
    return re.sub(r'[\\/:*?"<>|#^\[\]]+', "", clean_text(value))


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def load_paper_slug_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        papers = json.load(handle)
    return {clean_text(row.get("title")).lower(): clean_text(row.get("slug")) for row in papers}


@dataclass
class NodeRecord:
    paper_slug: str
    paper_title: str
    title: str
    node_id: str
    start_index: int | None
    end_index: int | None
    summary: str
    level: int
    parent_node_id: str | None
    child_node_ids: list[str]

    @property
    def note_title(self) -> str:
        return f"{self.paper_title} - {self.node_id} - {self.title}"

    @property
    def note_file(self) -> str:
        title_slug = slugify(self.title, limit=48) or "section"
        return f"{self.paper_slug}--{self.node_id}--{title_slug}.md"


def flatten_nodes(
    paper_slug: str,
    paper_title: str,
    nodes: list[dict[str, Any]],
    *,
    level: int = 1,
    parent_node_id: str | None = None,
) -> list[NodeRecord]:
    flattened: list[NodeRecord] = []
    for node in nodes:
        children = node.get("nodes") or []
        child_ids = [clean_text(child.get("node_id")) for child in children if clean_text(child.get("node_id"))]
        record = NodeRecord(
            paper_slug=paper_slug,
            paper_title=paper_title,
            title=clean_text(node.get("title")) or f"Untitled {clean_text(node.get('node_id'))}",
            node_id=clean_text(node.get("node_id")),
            start_index=node.get("start_index"),
            end_index=node.get("end_index"),
            summary=clean_text(node.get("summary")),
            level=level,
            parent_node_id=parent_node_id,
            child_node_ids=child_ids,
        )
        flattened.append(record)
        flattened.extend(
            flatten_nodes(
                paper_slug,
                paper_title,
                children,
                level=level + 1,
                parent_node_id=record.node_id,
            )
        )
    return flattened


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def render_paper_note(
    paper_title: str,
    paper_slug: str,
    doc_name: str,
    pdf_path: str,
    json_path: str,
    nodes: list[NodeRecord],
) -> str:
    top_level = [node for node in nodes if node.parent_node_id is None]
    lines = [
        "---",
        f'title: "{paper_title}"',
        f'paper_slug: "{paper_slug}"',
        f'doc_name: "{doc_name}"',
        f'pdf_path: "{pdf_path}"',
        f'json_path: "{json_path}"',
        "kind: pageindex-paper",
        "---",
        "",
        f"# {paper_title}",
        "",
        "[[PageIndex Wiki Home]]",
        "",
        "## Source Files",
        f"- PDF: `{pdf_path}`" if pdf_path else "- PDF: unavailable",
        f"- PageIndex JSON: `{json_path}`",
        "",
        "## Top-Level Sections",
    ]
    if top_level:
        for node in top_level:
            pages = format_page_span(node.start_index, node.end_index)
            lines.append(f"- [[Sections/{node.note_file.removesuffix('.md')}|{node.title}]] ({pages})")
    else:
        lines.append("- No structured sections found.")

    lines.extend(
        [
            "",
            "## All Section Notes",
        ]
    )
    for node in nodes:
        lines.append(f"- [[Sections/{node.note_file.removesuffix('.md')}|{node.node_id} {node.title}]]")
    return "\n".join(lines)


def format_page_span(start_index: int | None, end_index: int | None) -> str:
    if start_index is None and end_index is None:
        return "pages unknown"
    if start_index == end_index:
        return f"p. {start_index}"
    return f"pp. {start_index}-{end_index}"


def render_section_note(node: NodeRecord, lookup: dict[str, NodeRecord]) -> str:
    parent_link = ""
    if node.parent_node_id and node.parent_node_id in lookup:
        parent = lookup[node.parent_node_id]
        parent_link = f"[[{parent.note_file.removesuffix('.md')}|{parent.node_id} {parent.title}]]"

    child_links = []
    for child_node_id in node.child_node_ids:
        child = lookup.get(child_node_id)
        if child:
            child_links.append(f"[[{child.note_file.removesuffix('.md')}|{child.node_id} {child.title}]]")

    lines = [
        "---",
        f'title: "{node.note_title}"',
        f'paper_slug: "{node.paper_slug}"',
        f'paper_title: "{node.paper_title}"',
        f'node_id: "{node.node_id}"',
        f"level: {node.level}",
        f'start_index: "{node.start_index if node.start_index is not None else ""}"',
        f'end_index: "{node.end_index if node.end_index is not None else ""}"',
        f'parent_node_id: "{node.parent_node_id or ""}"',
        "kind: pageindex-section",
        "---",
        "",
        f"# {node.title}",
        "",
        f"[[Papers/{note_name(node.paper_title)}|{node.paper_title}]]",
        "",
        "## Context",
        f"- Node ID: `{node.node_id}`",
        f"- Depth: `{node.level}`",
        f"- Pages: {format_page_span(node.start_index, node.end_index)}",
        f"- Parent: {parent_link if parent_link else 'root section'}",
        "",
        "## Summary",
        node.summary or "No summary available.",
        "",
        "## Child Sections",
    ]
    if child_links:
        lines.extend([f"- {item}" for item in child_links])
    else:
        lines.append("- No child sections.")
    return "\n".join(lines)


def build_home_note(papers: list[dict[str, str]]) -> str:
    lines = [
        "---",
        'title: "PageIndex Wiki Home"',
        "kind: pageindex-home",
        "---",
        "",
        "# PageIndex Wiki Home",
        "",
        "Linked Markdown export of the `PageIndex` document structures in this repo.",
        "",
        "## Papers",
    ]
    for paper in sorted(papers, key=lambda item: item["paper_title"].lower()):
        lines.append(f'- [[Papers/{note_name(paper["paper_title"])}|{paper["paper_title"]}]]')
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export PageIndex JSON structures into an Obsidian-style Markdown wiki.")
    parser.add_argument(
        "--repo-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Path to the dyi-biofabrication repo.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Destination for the Markdown wiki. Defaults to docs/pageindex-wiki under the repo root.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete the output directory before regenerating the wiki.",
    )
    args = parser.parse_args()

    repo_root = args.repo_root.resolve()
    output_dir = args.output_dir.resolve() if args.output_dir else repo_root / "docs" / "pageindex-wiki"
    papers_dir = output_dir / "Papers"
    sections_dir = output_dir / "Sections"

    if args.clean and output_dir.exists():
        shutil.rmtree(output_dir)

    manifest_path = repo_root / "pageindex" / "pageindex_manifest.csv"
    slug_map_path = repo_root / "site" / "src" / "data" / "generated" / "papers.json"
    slug_map = load_paper_slug_map(slug_map_path)
    manifest_rows = load_csv_rows(manifest_path)

    exported_papers: list[dict[str, str]] = []

    for row in manifest_rows:
        json_value = clean_text(row.get("output_json"))
        if not json_value:
            continue
        json_path = Path(json_value)
        if not json_path.exists() or not json_path.is_file():
            continue

        with json_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        paper_title = clean_text(row.get("paper_title")) or clean_text(payload.get("doc_name")).removesuffix(".pdf")
        paper_slug = slug_map.get(paper_title.lower()) or slugify(paper_title)
        doc_name = clean_text(payload.get("doc_name"))
        pdf_path = clean_text(row.get("pdf_path"))
        structure = payload.get("structure") or []

        nodes = flatten_nodes(paper_slug, paper_title, structure)
        node_lookup = {node.node_id: node for node in nodes if node.node_id}

        paper_note = render_paper_note(
            paper_title=paper_title,
            paper_slug=paper_slug,
            doc_name=doc_name,
            pdf_path=pdf_path,
            json_path=str(json_path),
            nodes=nodes,
        )
        write_text(papers_dir / f"{note_name(paper_title)}.md", paper_note)

        for node in nodes:
            section_note = render_section_note(node, node_lookup)
            write_text(sections_dir / node.note_file, section_note)

        exported_papers.append(
            {
                "paper_title": paper_title,
                "paper_slug": paper_slug,
            }
        )

    write_text(output_dir / "PageIndex Wiki Home.md", build_home_note(exported_papers))
    print(f"Exported {len(exported_papers)} paper notes to {output_dir}")


if __name__ == "__main__":
    main()
