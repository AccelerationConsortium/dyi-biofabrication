import { githubRepoUrl } from "../config/site";

/**
 * Turns the rebuild-report form into a prefilled GitHub issue.
 *
 * Same handoff as the suggest form: nothing leaves the browser until the person clicks
 * through, and the page keeps no state of its own. Field ids match the ids in
 * .github/ISSUE_TEMPLATE/rebuild-report.yml so GitHub populates the issue form.
 */

const FIELDS = ["build", "outcome", "build-time", "actual-cost", "setting", "docs-gaps", "measured", "notes"];

function value(id) {
  const el = document.getElementById(`rr-${id}`);
  return el && "value" in el ? String(el.value || "").trim() : "";
}

function draft() {
  const out = {};
  for (const id of FIELDS) out[id] = value(id);
  return out;
}

function previewText(d) {
  const line = (label, v) => (v ? `${label}: ${v}` : null);
  return [
    line("Build", d.build || "—"),
    line("Outcome", d.outcome),
    line("Time spent", d["build-time"]),
    line("Actual cost paid", d["actual-cost"]),
    line("Setting", d.setting),
    "",
    "What the documentation missed:",
    d["docs-gaps"] || "—",
    d.measured ? "\nPerformance measured:" : null,
    d.measured || null,
    d.notes ? "\nNotes:" : null,
    d.notes || null
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function issueUrl(d) {
  const params = new URLSearchParams({ template: "rebuild-report.yml" });
  params.set("title", `Rebuild report: ${d.build || ""}`.trim());
  for (const id of FIELDS) if (d[id]) params.set(id, d[id]);
  return `${githubRepoUrl}/issues/new?${params.toString()}`;
}

export function initRebuildReport() {
  const form = document.getElementById("rebuild-form");
  if (!form) return;

  const preview = document.getElementById("rr-preview");
  const status = document.getElementById("rr-status");
  const openLink = document.getElementById("rr-open");
  const copyButton = document.getElementById("rr-copy");

  // A build can be passed in from a record page so the reporter does not retype it.
  const requested = new URLSearchParams(window.location.search).get("build");
  const buildField = document.getElementById("rr-build");
  if (requested && buildField && !buildField.value) buildField.value = requested;

  function update() {
    const d = draft();
    const ready = Boolean(d.build && d.outcome && d["docs-gaps"]);
    if (preview) preview.textContent = previewText(d);
    if (status) {
      status.textContent = ready
        ? "Ready. Review the report, then open the GitHub issue."
        : "Name the build, pick an outcome, and say what the documentation missed.";
    }
    if (openLink) {
      if (ready) {
        openLink.setAttribute("href", issueUrl(d));
        openLink.removeAttribute("aria-disabled");
      } else {
        openLink.setAttribute("href", `${githubRepoUrl}/issues/new`);
        openLink.setAttribute("aria-disabled", "true");
      }
    }
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);

  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(previewText(draft()));
      if (status) status.textContent = "Copied to clipboard.";
    } catch {
      if (status) status.textContent = "Couldn't copy automatically — select the text above and copy manually.";
    }
  });

  update();
}
