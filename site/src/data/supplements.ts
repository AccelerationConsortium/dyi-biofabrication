import { assets } from "./loaders";
import type { PaperRecord } from "./types";

/**
 * Design files that reach the reader only as the article's supplementary information.
 *
 * A record with no repository can still ship its CAD, bill of materials or firmware as a
 * publisher-hosted file. The curated manifest records those files as assets whose URL is
 * the file itself, so the Files facet counts them; this helper hands the card and the
 * record page the link for each file type, so the icon opens the file rather than only
 * saying it exists. Repository-hosted assets are left to the repository link.
 */
export interface FileLink {
  type: string;
  url: string;
}

export function supplementLinksFor(paper: PaperRecord): FileLink[] {
  const ids = new Set(paper.assetIds ?? []);
  const repoHost = hostOf(paper.repo?.url ?? "");
  const out: FileLink[] = [];
  for (const asset of assets) {
    // Only assets a curator recorded by hand: the heuristic ones point at the article DOI,
    // which is not a file.
    if (!ids.has(asset.id) || !asset.url || asset.provenanceSource !== "manifest") continue;
    if (repoHost && hostOf(asset.url) === repoHost) continue;
    if (!out.some((l) => l.type === asset.type)) out.push({ type: asset.type, url: asset.url });
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
