import { githubRepoUrl } from "../config/site";

/**
 * The six-step "Propose a paper" form.
 *
 * Nothing leaves the browser until the person opens the pre-filled GitHub issue; the draft
 * is kept in sessionStorage so a reload does not lose five steps of work, and is cleared
 * with the tab. Every key sent to GitHub is a field `id` in
 * .github/ISSUE_TEMPLATE/suggest-record.yml -- that is the whole contract, see
 * docs/suggest-form.md.
 */

const STORAGE_KEY = "atlas-propose-draft";
const TEMPLATE = "suggest-record.yml";

const METRIC_LABELS = {
  "motion-accuracy": "Motion accuracy",
  "volumetric-accuracy": "Volumetric accuracy",
  "cell-viability": "Cell viability",
  "unattended-operation": "Unattended operation",
  "standard-compliance": "Standard compliance"
};

const ROLE_LABELS = {
  author: "Author of the paper",
  builder: "Has built or used the design",
  reader: "Reader of the paper"
};

const byId = (id) => document.getElementById(id);
const text = (id) => {
  const el = byId(id);
  return el && "value" in el ? String(el.value || "").trim() : "";
};
const checkedValues = (name) =>
  Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
const checkedOne = (name) => checkedValues(name)[0] || "";

/* ---------------------------------------------------------------- draft */

function readDraft(form) {
  const rows = Array.from(form.querySelectorAll("#si-list .si-row"))
    .map((row) => ({
      kind: row.querySelector(".si-kind")?.value || "",
      link: row.querySelector(".si-link")?.value.trim() || "",
      note: row.querySelector(".si-note")?.value.trim() || ""
    }))
    .filter((r) => r.kind || r.link || r.note);

  const metrics = Object.keys(METRIC_LABELS)
    .map((id) => ({ id, label: METRIC_LABELS[id], value: text(`m-${id}-value`), where: text(`m-${id}-where`) }))
    .filter((m) => m.value || m.where);

  const scores = Array.from(form.querySelectorAll(".score-row"))
    .map((row) => {
      const id = row.dataset.criterion;
      const value = checkedOne(`s-${id}`);
      return {
        id,
        name: row.querySelector(".score-name")?.textContent.trim() || id,
        value,
        anchor: value ? anchorFor(row, text("s-technique"), Number(value)) : "",
        why: text(`s-${id}-why`)
      };
    })
    .filter((s) => s.value || s.why);

  const amount = text("o-cost");
  return {
    title: text("p-title"),
    doi: text("p-doi"),
    venue: text("p-venue"),
    area: text("p-area"),
    tool: text("p-tool"),
    description: text("p-description"),
    why: text("p-why"),
    role: checkedOne("p-role"),
    repo: text("o-repo"),
    licence: text("o-licence"),
    skill: text("o-skill"),
    files: checkedValues("o-files"),
    cost: amount ? [amount, text("o-currency"), text("o-cost-note") ? `(${text("o-cost-note")})` : ""].filter(Boolean).join(" ") : "",
    si: rows,
    attach: Boolean(byId("si-attach")?.checked),
    technique: text("s-technique"),
    metrics,
    scores
  };
}

function anchorFor(row, technique, value) {
  try {
    const anchors = JSON.parse(row.dataset.anchors || "{}");
    const set = anchors[technique] || Object.values(anchors)[0];
    return set?.anchors?.[value - 1] || "";
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------ rendering */

function supplementaryText(d) {
  const lines = d.si.map((r) => `- ${[r.kind, r.link, r.note].filter(Boolean).join(" — ")}`);
  if (d.attach) lines.push("- Files attached to this issue (dragged in below).");
  return lines.join("\n");
}

function performanceText(d) {
  return d.metrics
    .map((m) => `${m.label}: ${m.value || "reported"}${m.where ? ` (${m.where})` : ""}`)
    .join("\n");
}

function scoresText(d) {
  const head = d.scores.length ? [`Anchors: ${d.technique}. Proposed by the submitter; pending curator validation.`] : [];
  return head
    .concat(d.scores.map((s) => `${s.name}: ${s.value || "—"}${s.anchor ? ` (${s.anchor})` : ""}${s.why ? ` — ${s.why}` : ""}`))
    .join("\n");
}

function previewText(d) {
  const line = (label, v) => (v ? `${label}: ${v}` : null);
  const block = (label, v) => (v ? ["", `${label}:`, v] : []);
  return [
    line("Paper", d.title || "—"),
    line("DOI", d.doi),
    line("Journal and year", d.venue),
    line("Area", d.area),
    line("Instrument", d.tool),
    line("Submitter", ROLE_LABELS[d.role]),
    ...block("What it is", d.description || "—"),
    ...block("Why it belongs", d.why),
    "",
    line("Design files", d.repo) || "Design files: not given",
    line("Licence on the design files", d.licence),
    line("Files provided", d.files.join(", ")),
    line("Cost", d.cost),
    line("Skill needed", d.skill),
    ...block("Supplementary material to review", supplementaryText(d)),
    ...block("Performance the paper reports", performanceText(d)),
    ...block("Proposed rubric scores", scoresText(d))
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function issueUrl(d) {
  const params = new URLSearchParams({ template: TEMPLATE });
  params.set("title", `Propose paper: ${d.title}`.trim());
  const set = (key, value) => value && params.set(key, value);
  set("paper", d.title);
  set("doi", d.doi);
  set("venue", d.venue);
  set("area", d.area);
  set("instrument", d.tool);
  set("role", ROLE_LABELS[d.role]);
  set("description", d.description);
  set("why", d.why);
  set("repo", d.repo);
  set("licence", d.licence);
  set("files", d.files.join(", "));
  set("cost", d.cost);
  set("skill", d.skill);
  set("supplementary", supplementaryText(d));
  set("performance", performanceText(d));
  set("scores", scoresText(d));
  return `${githubRepoUrl}/issues/new?${params.toString()}`;
}

/* ----------------------------------------------------------- persistence */

function snapshot(form) {
  const out = {};
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!el.id && !el.name) return;
    if (el.type === "checkbox" || el.type === "radio") {
      if (el.checked) out[el.id || `${el.name}=${el.value}`] = true;
    } else if (el.id) {
      out[el.id] = el.value;
    }
  });
  out.__si = Array.from(form.querySelectorAll("#si-list .si-row")).map((row) => [
    row.querySelector(".si-kind")?.value || "",
    row.querySelector(".si-link")?.value || "",
    row.querySelector(".si-note")?.value || ""
  ]);
  return out;
}

function save(form, step) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, fields: snapshot(form) }));
  } catch {
    /* storage unavailable: the page still works, it just forgets on reload */
  }
}

function restore(form, addSiRow) {
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved?.fields) return 1;
  const f = saved.fields;
  if (Array.isArray(f.__si) && f.__si.length) {
    const list = byId("si-list");
    if (list) list.innerHTML = "";
    f.__si.forEach(([kind, link, note]) => addSiRow({ kind, link, note }));
  }
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") {
      el.checked = Boolean(f[el.id || `${el.name}=${el.value}`]);
    } else if (el.id && typeof f[el.id] === "string") {
      el.value = f[el.id];
    }
  });
  return Number(saved.step) || 1;
}

/* --------------------------------------------------------------- init */

export function initSuggestForm() {
  const form = byId("suggest-form");
  if (!form) return;

  const total = Number(form.dataset.steps) || 6;
  const panels = Array.from(form.querySelectorAll("[data-step]"));
  const tabs = Array.from(form.querySelectorAll("[data-step-tab]"));
  const status = byId("suggest-status");
  const preview = byId("suggest-preview");
  const openLink = byId("open-issue");
  const back = byId("step-back");
  const next = byId("step-next");
  const count = byId("step-count");
  const areaSelect = byId("p-area");
  const techniqueSelect = byId("s-technique");
  const siList = byId("si-list");
  const siTemplate = byId("si-template");
  let step = 1;
  let techniqueTouched = false;

  /* Supplementary rows */
  function addSiRow(values) {
    if (!siList || !siTemplate) return;
    const node = siTemplate.content.firstElementChild.cloneNode(true);
    if (values) {
      node.querySelector(".si-kind").value = values.kind || "";
      node.querySelector(".si-link").value = values.link || "";
      node.querySelector(".si-note").value = values.note || "";
    }
    siList.appendChild(node);
  }
  byId("si-add")?.addEventListener("click", () => {
    addSiRow();
    siList?.lastElementChild?.querySelector("select")?.focus();
    update();
  });
  siList?.addEventListener("click", (event) => {
    const button = event.target.closest(".si-remove");
    if (!button) return;
    if (siList.children.length === 1) {
      siList.querySelectorAll("input, select").forEach((el) => (el.value = ""));
    } else {
      button.closest(".si-row")?.remove();
    }
    update();
  });

  /* Scores: anchor text follows the chosen value and the technique */
  function refreshAnchors() {
    const technique = techniqueSelect?.value || "";
    form.querySelectorAll(".score-row").forEach((row) => {
      const id = row.dataset.criterion;
      const value = checkedOne(`s-${id}`);
      const out = row.querySelector("[data-anchor-for]");
      let anchors = {};
      try {
        anchors = JSON.parse(row.dataset.anchors || "{}");
      } catch {
        /* leave empty */
      }
      const set = anchors[technique] || Object.values(anchors)[0] || {};
      if (value) {
        row.dataset.scored = "";
        if (out) out.textContent = `${value} — ${set.anchors?.[Number(value) - 1] || ""}`;
      } else {
        delete row.dataset.scored;
        if (out) out.textContent = set.extract ? `Judged on: ${set.extract}.` : "Choose a score to see its anchor.";
      }
    });
  }
  form.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-clear]");
    if (!clear) return;
    form.querySelectorAll(`input[name="${clear.dataset.clear}"]`).forEach((el) => (el.checked = false));
    update();
  });
  techniqueSelect?.addEventListener("change", () => {
    techniqueTouched = true;
  });
  areaSelect?.addEventListener("change", () => {
    if (techniqueTouched || !techniqueSelect) return;
    const technique = areaSelect.selectedOptions[0]?.dataset.technique;
    if (technique) techniqueSelect.value = technique;
  });

  /* Steps */
  function requiredMissing(n) {
    if (n !== 1) return [];
    return [
      ["p-title", "a title"],
      ["p-area", "an application area"],
      ["p-description", "a description"]
    ].filter(([id]) => !text(id));
  }

  function show(n, scroll = true) {
    step = Math.min(total, Math.max(1, n));
    panels.forEach((panel) => {
      panel.hidden = Number(panel.dataset.step) !== step;
    });
    tabs.forEach((tab) => {
      const i = Number(tab.dataset.stepTab);
      const button = tab.querySelector("button");
      if (button) {
        if (i === step) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      }
      if (i < step) tab.dataset.done = "";
      else delete tab.dataset.done;
    });
    if (back) back.hidden = step === 1;
    if (next) next.hidden = step === total;
    if (count) count.textContent = `Step ${step} of ${total}`;
    if (status) status.textContent = "";
    if (scroll) form.querySelector(".steps")?.scrollIntoView({ block: "start", behavior: "instant" });
    update();
  }

  function tryGo(n) {
    if (n > step) {
      for (let i = step; i < n; i += 1) {
        const missing = requiredMissing(i);
        if (missing.length) {
          show(i);
          if (status) status.textContent = `Step ${i} still needs ${missing.map((m) => m[1]).join(", ")}.`;
          byId(missing[0][0])?.focus();
          return;
        }
      }
    }
    show(n);
  }

  back?.addEventListener("click", () => tryGo(step - 1));
  next?.addEventListener("click", () => tryGo(step + 1));
  form.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) tryGo(Number(go.dataset.go));
  });
  form.addEventListener("keydown", (event) => {
    // Enter in a single-line field advances rather than submitting nothing.
    if (event.key === "Enter" && event.target.tagName === "INPUT" && event.target.type !== "checkbox" && event.target.type !== "radio") {
      event.preventDefault();
      if (step < total) tryGo(step + 1);
    }
  });

  /* Preview and hand-off */
  function update() {
    refreshAnchors();
    const d = readDraft(form);
    const ready = Boolean(d.title && d.area && d.description);
    const confirmed = Boolean(byId("c-links")?.checked && byId("c-scores")?.checked);
    if (preview) preview.textContent = previewText(d);
    if (openLink) {
      if (ready && confirmed) {
        openLink.setAttribute("href", issueUrl(d));
        openLink.removeAttribute("aria-disabled");
        openLink.title = "";
      } else {
        openLink.setAttribute("href", `${githubRepoUrl}/issues/new`);
        openLink.setAttribute("aria-disabled", "true");
        openLink.title = ready ? "Tick both confirmations first." : "Step 1 needs a title, an area and a description.";
      }
    }
    save(form, step);
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);

  byId("copy-details")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(previewText(readDraft(form)));
      if (status) status.textContent = "Copied to clipboard.";
    } catch {
      if (status) status.textContent = "Couldn't copy automatically — select the text above and copy it.";
    }
  });

  byId("suggest-reset")?.addEventListener("click", () => {
    if (!window.confirm("Clear everything you entered?")) return;
    form.reset();
    if (siList) {
      siList.innerHTML = "";
      addSiRow();
    }
    techniqueTouched = false;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
    show(1);
  });

  show(restore(form, addSiRow), false);
}
