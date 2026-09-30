import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const papersPath = path.join(siteRoot, "src", "data", "generated", "papers.json");
const outputPath = path.join(siteRoot, "src", "data", "enrichment", "repo_accessibility.json");
const refresh = process.argv.includes("--refresh");
const USER_AGENT = "DIY-Biofabrication-Atlas/1.0 (repository accessibility check)";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

function githubRepoPath(url) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)github\.com$/.test(parsed.hostname)) return "";
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return "";
    return `${owner}/${repo.replace(/\.git$/, "")}`;
  } catch {
    return "";
  }
}

async function headOrGet(url) {
  const headers = { "User-Agent": USER_AGENT };
  try {
    let response = await fetch(url, { method: "HEAD", headers, redirect: "follow" });
    // Some hosts reject HEAD; fall back to a ranged GET.
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: "GET", headers, redirect: "follow" });
    }
    return { status: response.status, finalUrl: response.url || url };
  } catch (error) {
    return { status: 0, finalUrl: url, error: String(error.message || error) };
  }
}

/** GitHub: pushed_at is the most recent push to any branch — our "last activity". */
async function checkGithub(repoPath) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
  };
  const response = await fetch(`https://api.github.com/repos/${repoPath}`, { headers });
  if (!response.ok) {
    return { accessible: response.status !== 404, httpStatus: response.status, error: `github api ${response.status}` };
  }
  const data = await response.json();
  return {
    accessible: true,
    httpStatus: 200,
    lastActivity: data.pushed_at || data.updated_at || "",
    lastActivitySource: "github:pushed_at",
    archived: Boolean(data.archived),
    license: data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION" ? data.license.spdx_id : "",
    defaultBranch: data.default_branch || "",
    stars: data.stargazers_count ?? null,
    openIssues: data.open_issues_count ?? null
  };
}

/** Everything else (OSF, Zenodo, Mendeley Data, project sites): reachability only. */
async function checkGeneric(url) {
  const { status, finalUrl, error } = await headOrGet(url);
  return {
    accessible: status >= 200 && status < 400,
    httpStatus: status,
    finalUrl,
    lastActivity: "",
    lastActivitySource: "",
    ...(error ? { error } : {})
  };
}

async function checkUrl(url) {
  const repoPath = githubRepoPath(url);
  const base = { url, host: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })() };
  try {
    const result = repoPath ? await checkGithub(repoPath) : await checkGeneric(url);
    return { ...base, ...result, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { ...base, accessible: false, httpStatus: 0, error: String(error.message || error), checkedAt: new Date().toISOString() };
  }
}

const papers = JSON.parse(fs.readFileSync(papersPath, "utf8"));
const urls = [...new Set(papers.map((paper) => clean(paper.repo?.url)).filter(Boolean))];

const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : { records: {} };
const records = refresh ? {} : { ...(existing.records || {}) };

for (const [index, url] of urls.entries()) {
  if (!refresh && records[url]?.checkedAt) {
    console.log(`${index + 1}/${urls.length} cached: ${url}`);
    continue;
  }
  records[url] = await checkUrl(url);
  const { accessible, httpStatus, lastActivity, archived } = records[url];
  console.log(
    `${index + 1}/${urls.length} ${accessible ? "ok" : "UNREACHABLE"} (${httpStatus})` +
      `${lastActivity ? ` last activity ${lastActivity.slice(0, 10)}` : ""}${archived ? " [archived]" : ""}: ${url}`
  );
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), records }, null, 2)}\n`);

const reachable = Object.values(records).filter((record) => record.accessible).length;
console.log(`\nSaved ${Object.keys(records).length} repo checks (${reachable} reachable) to ${outputPath}`);
