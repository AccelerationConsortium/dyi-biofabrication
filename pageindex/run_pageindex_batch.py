from __future__ import annotations

import argparse
import csv
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BatchConfig:
    repo_root: Path
    pageindex_root: Path
    output_root: Path
    manifest_path: Path
    limit: int | None
    overwrite: bool
    model: str | None
    extra_args: list[str]


def parse_args() -> BatchConfig:
    parser = argparse.ArgumentParser(description="Run PageIndex over downloaded PDFs in dyi-biofabrication.")
    parser.add_argument("--repo-root", default="/Users/iyakavets/Documents/Github/dyi-biofabrication")
    parser.add_argument("--pageindex-root", default="/Users/iyakavets/Documents/Github/PageIndex")
    parser.add_argument("--output-root", default=None)
    parser.add_argument("--manifest-path", default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--model", default=None)
    parser.add_argument(
        "--extra-arg",
        action="append",
        default=[],
        help="Additional flag to pass through to run_pageindex.py. Repeat as needed.",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    output_root = Path(args.output_root).resolve() if args.output_root else repo_root / "pageindex" / "results"
    manifest_path = Path(args.manifest_path).resolve() if args.manifest_path else repo_root / "pageindex" / "pageindex_manifest.csv"

    return BatchConfig(
        repo_root=repo_root,
        pageindex_root=Path(args.pageindex_root).resolve(),
        output_root=output_root,
        manifest_path=manifest_path,
        limit=args.limit,
        overwrite=args.overwrite,
        model=args.model,
        extra_args=args.extra_arg,
    )


def load_pdf_rows(repo_root: Path) -> list[dict[str, str]]:
    manifest = repo_root / "pdfs" / "pdf_manifest.csv"
    with manifest.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return [row for row in rows if row.get("download_status") == "downloaded" and row.get("local_pdf_path")]


def sanitize_stem(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-._" else "_" for ch in value).strip("._")[:140] or "document"


def load_repo_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def ensure_ready(config: BatchConfig) -> None:
    if not config.pageindex_root.exists():
        raise FileNotFoundError(f"PageIndex checkout not found: {config.pageindex_root}")
    runner = config.pageindex_root / "run_pageindex.py"
    if not runner.exists():
        raise FileNotFoundError(f"PageIndex runner not found: {runner}")
    load_repo_env(config.repo_root / ".env")
    if not os.environ.get("OPENAI_API_KEY"):
        raise EnvironmentError("OPENAI_API_KEY is not set. PageIndex requires an LLM API key for indexing.")
    config.output_root.mkdir(parents=True, exist_ok=True)
    config.manifest_path.parent.mkdir(parents=True, exist_ok=True)


def build_command(config: BatchConfig, pdf_path: Path) -> list[str]:
    pageindex_python = config.pageindex_root / ".venv" / "bin" / "python"
    python_executable = str(pageindex_python) if pageindex_python.exists() else sys.executable
    command = [python_executable, str(config.pageindex_root / "run_pageindex.py"), "--pdf_path", str(pdf_path)]
    if config.model:
        command.extend(["--model", config.model])
    for extra in config.extra_args:
        command.append(extra)
    return command


def move_output(config: BatchConfig, pdf_path: Path) -> Path:
    source_json = config.pageindex_root / "results" / f"{pdf_path.stem}_structure.json"
    if not source_json.exists():
        raise FileNotFoundError(f"Expected PageIndex output not found: {source_json}")
    target_json = config.output_root / f"{sanitize_stem(pdf_path.stem)}_structure.json"
    shutil.move(str(source_json), str(target_json))
    return target_json


def main() -> None:
    config = parse_args()
    ensure_ready(config)

    rows = load_pdf_rows(config.repo_root)
    if config.limit is not None:
        rows = rows[: config.limit]

    manifest_rows: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        pdf_path = config.repo_root / row["local_pdf_path"]
        output_json = config.output_root / f"{sanitize_stem(pdf_path.stem)}_structure.json"
        if output_json.exists() and not config.overwrite:
            status = "skipped_existing"
            manifest_rows.append(
                {
                    "paper_title": row["paper_title"],
                    "pdf_path": str(pdf_path),
                    "output_json": str(output_json),
                    "status": status,
                }
            )
            print(f"[{index}/{len(rows)}] {row['paper_title']} -> {status}")
            continue

        command = build_command(config, pdf_path)
        result = subprocess.run(
            command,
            cwd=config.pageindex_root,
            text=True,
            capture_output=True,
        )
        if result.returncode != 0:
            status = f"failed:{result.returncode}"
            manifest_rows.append(
                {
                    "paper_title": row["paper_title"],
                    "pdf_path": str(pdf_path),
                    "output_json": "",
                    "status": status,
                }
            )
            print(f"[{index}/{len(rows)}] {row['paper_title']} -> {status}")
            print(result.stderr.strip() or result.stdout.strip())
            continue

        moved = move_output(config, pdf_path)
        status = "indexed"
        manifest_rows.append(
            {
                "paper_title": row["paper_title"],
                "pdf_path": str(pdf_path),
                "output_json": str(moved),
                "status": status,
            }
        )
        print(f"[{index}/{len(rows)}] {row['paper_title']} -> {status}")

    with config.manifest_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["paper_title", "pdf_path", "output_json", "status"])
        writer.writeheader()
        writer.writerows(manifest_rows)
    print(f"Manifest written: {config.manifest_path}")


if __name__ == "__main__":
    main()
