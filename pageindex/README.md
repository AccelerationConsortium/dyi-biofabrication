# PageIndex Setup

This repo can use `VectifyAI/PageIndex` to build tree-structured JSON indexes for the downloaded PDFs in `pdfs/`.

## Expected sibling checkouts

- `dyi-biofabrication`: `/Users/iyakavets/Documents/Github/dyi-biofabrication`
- `PageIndex`: `/Users/iyakavets/Documents/Github/PageIndex`

## PageIndex prerequisites

1. Install the PageIndex dependencies:

```bash
cd /Users/iyakavets/Documents/Github/PageIndex
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Add an API key before indexing:

```bash
export OPENAI_API_KEY=...
```

The batch wrapper automatically loads `OPENAI_API_KEY` from `dyi-biofabrication/.env` if present. Exporting it in the shell is also fine.

The upstream runner uses `run_pageindex.py` and writes raw outputs into `PageIndex/results/`. The batch wrapper moves those JSON files into the `dyi-biofabrication` repo.

## Batch indexing command

From anywhere:

```bash
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/run_pageindex_batch.py
```

Useful options:

```bash
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/run_pageindex_batch.py --limit 3
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/run_pageindex_batch.py --overwrite
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/run_pageindex_batch.py --model gpt-4o
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/run_pageindex_batch.py --extra-arg=--if-add-node-text --extra-arg=yes
```

## Repo outputs

- `pageindex/results/`: one `*_structure.json` per indexed PDF
- `pageindex/pageindex_manifest.csv`: per-PDF status for each batch run
- `docs/pageindex-wiki/`: generated Obsidian-style Markdown wiki from the PageIndex structures

## Markdown wiki export

Generate linked Markdown notes from the PageIndex JSON outputs:

```bash
python3 /Users/iyakavets/Documents/Github/dyi-biofabrication/pageindex/export_pageindex_wiki.py --clean
```

This writes:

- `docs/pageindex-wiki/PageIndex Wiki Home.md`
- `docs/pageindex-wiki/Papers/*.md`
- `docs/pageindex-wiki/Sections/*.md`

The export preserves the nested JSON structure as wikilinks between paper notes and section notes.

## Notes

- The current `pdfs/pdf_manifest.csv` shows `19` successfully downloaded PDFs, so that is the initial batch size.
- If `OPENAI_API_KEY` is missing, the wrapper fails early instead of starting partial runs.
- Some PDFs in the repo are inaccessible or unresolved and therefore are not yet part of the PageIndex batch.
