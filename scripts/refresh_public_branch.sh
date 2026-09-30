#!/usr/bin/env bash
# Rebuild the `main-public` branch as a single-commit snapshot of `main`.
#
# `main` carries the full history, and that history holds the article PDFs and full-text
# markdown that were committed before July 2026 (about 90 MB, 148 blobs) -- so `main` can
# never be made public as it is, even though the current tree tracks none of them.
# `main-public` has no history: one commit whose tree is exactly the tree of `main`. What
# `.gitignore` keeps out of `main` (pdfs/, pdfs/markdown/, pdfs/supplementary/, generated
# data) is therefore absent from it too, and so is the history.
#
# Run this after every merge into `main` that should reach the public branch:
#
#     scripts/refresh_public_branch.sh            # rebuild and push
#     scripts/refresh_public_branch.sh --no-push  # rebuild only
#
# The branch is force-pushed by design: it is a snapshot, not a line of work. Never commit
# directly on it. To publish it, push it to a public repository's main:
#
#     git push <public-remote> main-public:main --force
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
push=1
[[ "${1:-}" == "--no-push" ]] && push=0

if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree is not clean; commit or stash first" >&2
  exit 1
fi

src_commit=$(git rev-parse main)
tree=$(git rev-parse "main^{tree}")
msg="Public snapshot of main at ${src_commit:0:12}

Single commit, no history: the tree of main as of $(git log -1 --format=%cs main), with nothing
that .gitignore excludes there (article PDFs, full texts, supplementary files, generated data).
Rebuilt by scripts/refresh_public_branch.sh."

new_commit=$(git commit-tree "$tree" -m "$msg")
git update-ref refs/heads/main-public "$new_commit"
echo "main-public -> ${new_commit:0:12} (tree of main ${src_commit:0:12})"

# Belt and braces: the snapshot must hold no PDF or full-text file.
# (downloaded_papers/ holds only CSV/JSON manifests today; the PDFs themselves are ignored.)
if git ls-tree -r --name-only main-public | grep -Eiq '\.(pdf|docx|mov|mp4|avi|zip)$|^pdfs/markdown/|^pdfs/supplementary/'; then
  echo "refusing: main-public tree contains a PDF or full-text path" >&2
  exit 1
fi

if [[ $push -eq 1 ]]; then
  git push --force origin main-public
fi
