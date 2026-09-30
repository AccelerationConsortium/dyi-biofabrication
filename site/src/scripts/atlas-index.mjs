/**
 * The index: facets, search, sort, and the map that sits beside them.
 *
 * Cards and table rows are two renderings of the same 60 records, carrying identical
 * `data-*` attributes, so one filter pass hides both and the view switch only decides which
 * container is on screen. Filtering is pure DOM work -- 60 rows is far too few to justify
 * re-rendering anything.
 *
 * Every visible control writes itself into the URL, so a filtered view can be pasted into a
 * message and arrive the same way it left.
 */

const VIEW_KEY = "atlas-index-view";

/** Facet group -> the row data attribute it tests. Mirrors FACETS in index.astro. */
const FACET_KEYS = ["costband", "repostate", "area", "files", "licstate", "skill", "standard"];

/** `files` holds several values per row; the others hold exactly one. */
const MULTI_VALUE = new Set(["files"]);

/**
 * Sortable columns. The label names the column in the sort select when a header click
 * reaches an order the select does not already list; the direction is where the first
 * click on that header lands -- the one that answers the question the column raises.
 * `repo` sorts on a rank (reachable, link in text, none), not on text.
 */
const SORT_LABELS = {
  title: "Name",
  area: "Area",
  cost: "Cost",
  licence: "Licence",
  repo: "Design files",
  ease: "Build/skill",
  reports: "Reports",
  year: "Year"
};
const TEXT_SORTS = new Set(["title", "area", "licence"]);
const DEFAULT_DIRECTION = {
  title: "asc",
  area: "asc",
  cost: "asc",
  licence: "asc",
  repo: "asc",
  ease: "desc",
  reports: "desc",
  year: "desc"
};

export function initAtlasIndex() {
  const grid = document.getElementById("atlas-grid");
  if (!grid) return;

  const cards = /** @type {HTMLElement[]} */ ([...grid.querySelectorAll("[data-row]")]);
  const listRows = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-listrow]")]);
  const listWrap = document.getElementById("atlas-list");
  const search = /** @type {HTMLInputElement} */ (document.getElementById("atlas-q"));
  const sortSelect = /** @type {HTMLSelectElement} */ (document.getElementById("atlas-sort"));
  const count = document.getElementById("atlas-count");
  const empty = document.getElementById("atlas-empty");
  const activeBar = document.getElementById("atlas-active");
  const activeList = document.getElementById("atlas-active-list");
  const clearButton = document.getElementById("atlas-clear");
  const checkboxes = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll("[data-facet]")]);
  const selection = document.getElementById("atlas-selection");
  const sortButtons = /** @type {HTMLButtonElement[]} */ ([
    ...document.querySelectorAll("#atlas-list thead [data-sort]")
  ]);
  let currentSort = sortSelect.value;

  /** Row lookup by slug, so a map node can find its card without a second pass. */
  const bySlug = new Map(cards.map((el) => [el.dataset.slug, el]));

  /** node id -> the cards that answer to it. Built once; the map never changes shape. */
  const byNode = new Map();
  for (const card of cards) {
    for (const id of (card.dataset.nodes || "").split(" ")) {
      if (!id) continue;
      if (!byNode.has(id)) byNode.set(id, []);
      byNode.get(id).push(card);
    }
  }

  /** group -> Set of checked values. An empty set means the group is not filtering. */
  const active = new Map(FACET_KEYS.map((k) => [k, new Set()]));
  let restoring = true; // suppresses URL writes and scrolling while we apply ?params

  // ---------------------------------------------------------------- URL

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) search.value = params.get("q");
    if (params.has("sort")) currentSort = params.get("sort");
    for (const key of FACET_KEYS) {
      const raw = params.get(key);
      if (!raw) continue;
      const values = new Set(raw.split(",").filter(Boolean));
      active.set(key, values);
      for (const box of checkboxes) {
        if (box.dataset.facet === key && values.has(box.value)) {
          box.checked = true;
          // A tick restored into a closed group would be invisible; open the group.
          const group = box.closest("details");
          if (group) group.open = true;
        }
      }
    }
    const view = params.get("view");
    if (view === "list" || view === "cards") setView(view, false);
  }

  function writeUrl() {
    if (restoring) return;
    const params = new URLSearchParams();
    const term = search.value.trim();
    if (term) params.set("q", term);
    for (const [key, values] of active) {
      if (values.size) params.set(key, [...values].join(","));
    }
    if (currentSort !== "title:asc") params.set("sort", currentSort);
    if (currentView === "list") params.set("view", "list");
    const query = params.toString();
    history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  // ---------------------------------------------------------------- filtering

  function matches(el) {
    const term = search.value.trim().toLowerCase();
    if (term && !(el.dataset.search || "").includes(term)) return false;

    for (const [key, values] of active) {
      if (!values.size) continue;
      const raw = el.dataset[key] || "";
      // Within a group the options are alternatives; across groups they all have to hold.
      const held = MULTI_VALUE.has(key)
        ? raw.split(" ").some((v) => values.has(v))
        : values.has(raw);
      if (!held) return false;
    }

    return true;
  }

  function apply() {
    const visible = new Set();
    let shown = 0;

    for (const card of cards) {
      const ok = matches(card);
      card.hidden = !ok;
      if (ok) {
        shown += 1;
        visible.add(card.dataset.slug);
        for (const id of (card.dataset.nodes || "").split(" ")) if (id) visible.add(id);
      }
    }
    for (const row of listRows) row.hidden = !visible.has(row.dataset.slug);

    count.textContent = shown === cards.length ? `${shown} builds` : `${shown} of ${cards.length} builds`;
    empty.hidden = shown !== 0;
    renderActive();
    // The map shows the same set as the results, so a facet narrows both at once.
    graph?.setVisible?.(shown === cards.length ? null : visible);
    writeUrl();
  }

  // ---------------------------------------------------------------- sorting

  function sortBy(value) {
    const [key, dir] = value.split(":");
    const prop = `sort${key[0].toUpperCase()}${key.slice(1)}`;
    const numeric = !TEXT_SORTS.has(key);

    const order = (a, b) => {
      const rawA = a.dataset[prop] ?? "";
      const rawB = b.dataset[prop] ?? "";
      // A row with no value for this column sinks, whichever way the sort runs: "cheapest
      // first" should open on the cheapest builds, not on the 25 whose cost nobody recorded.
      if (rawA === "" && rawB === "") return 0;
      if (rawA === "") return 1;
      if (rawB === "") return -1;
      const cmp = numeric ? Number(rawA) - Number(rawB) : rawA.localeCompare(rawB);
      return dir === "asc" ? cmp : -cmp;
    };

    for (const el of [...cards].sort(order)) grid.appendChild(el);
    const tbody = listRows[0]?.parentElement;
    if (tbody) for (const el of [...listRows].sort(order)) tbody.appendChild(el);
  }

  /**
   * The select and the column headers are two controls over one piece of state, so both
   * are set from one place. A header can reach an order the select's shortlist does not
   * list -- "Licence Z-A" -- and rather than let the select sit there naming a different
   * order, the missing option is added to it.
   */
  function applySort(value) {
    const [key, dir] = String(value).split(":");
    if (!SORT_LABELS[key] || (dir !== "asc" && dir !== "desc")) return;
    currentSort = `${key}:${dir}`;

    if (![...sortSelect.options].some((o) => o.value === currentSort)) {
      const way = TEXT_SORTS.has(key)
        ? dir === "asc" ? "A\u2013Z" : "Z\u2013A"
        : dir === "asc" ? "low first" : "high first";
      sortSelect.add(new Option(`${SORT_LABELS[key]}, ${way}`, currentSort));
    }
    sortSelect.value = currentSort;

    for (const button of sortButtons) {
      const cell = button.closest("th");
      if (!cell) continue;
      cell.setAttribute(
        "aria-sort",
        button.dataset.sort !== key ? "none" : dir === "asc" ? "ascending" : "descending"
      );
    }

    sortBy(currentSort);
  }

  // ---------------------------------------------------------------- active chips

  function labelFor(box) {
    return box.parentElement?.querySelector("span")?.textContent?.trim() || box.value;
  }

  function renderActive() {
    const chips = [];
    for (const box of checkboxes) {
      if (box.checked) chips.push({ kind: "facet", key: box.dataset.facet, value: box.value, label: labelFor(box) });
    }
    const term = search.value.trim();
    if (term) chips.push({ kind: "q", label: `“${term}”` });

    activeList.replaceChildren(
      ...chips.map((chip) => {
        const li = document.createElement("li");
        li.append(chip.label);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${chip.label}`);
        remove.addEventListener("click", () => {
          if (chip.kind === "q") search.value = "";
          else {
            active.get(chip.key)?.delete(chip.value);
            const box = checkboxes.find((b) => b.dataset.facet === chip.key && b.value === chip.value);
            if (box) box.checked = false;
          }
          apply();
        });
        li.append(remove);
        return li;
      })
    );
    activeBar.hidden = chips.length === 0;

    const facetCount = chips.filter((c) => c.kind === "facet").length;
    const badge = document.getElementById("atlas-filters-count");
    if (badge) {
      badge.textContent = facetCount ? ` ${facetCount}` : "";
      badge.hidden = facetCount === 0;
    }
  }

  // ---------------------------------------------------------------- view switch

  let currentView = "cards";

  /**
   * The view switch is hidden below 900px, where cards are the better rendering and a
   * seven-column table only scrolls sideways. Without this, a "list" choice saved on a
   * desktop -- or arriving in a shared ?view=list link -- would strand a phone in that
   * table with no control to leave it.
   */
  const wideEnoughForList = window.matchMedia("(min-width: 900px)");

  function setView(view, persist = true) {
    if (view === "list" && !wideEnoughForList.matches) view = "cards";
    currentView = view;
    document.querySelector(".workspace")?.setAttribute("data-view", view);
    grid.hidden = view !== "cards";
    if (listWrap) listWrap.hidden = view !== "list";
    for (const button of document.querySelectorAll("[data-view-option]")) {
      button.setAttribute("aria-pressed", String(button.dataset.viewOption === view));
    }
    if (persist) {
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {
        /* private mode: the choice simply does not persist */
      }
      writeUrl();
    }
  }

  // ---------------------------------------------------------------- the map

  /** Filled once GraphExplorer announces its instance. */
  let graph = null;

  /** Per-build facts for the panel under the map, emitted by the page. */
  const rowData = (() => {
    try {
      return JSON.parse(document.getElementById("atlas-row-data")?.textContent || "{}");
    } catch {
      return {};
    }
  })();

  
  function statRow(label, value, title, href) {
    if (!value) return null;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = value;
      dd.append(a);
    } else {
      dd.textContent = value;
    }
    if (title) dd.title = title;
    const wrap = document.createElement("div");
    wrap.append(dt, dd);
    return wrap;
  }

  /**
   * The space under the map used to hold a name and a link. It now carries the same facts
   * the card does, so a node can be inspected without hunting for its card in the results.
   * Absent values are left out entirely here rather than shown as a dash: the panel is a
   * summary of one record, and six dashes would say less than four facts.
   */
  /**
   * The panel under the map describes the selected node. For a build it adds to the card
   * rather than repeating it: the card already has cost, licence, files, ease and the five
   * marks, so the panel carries what the card cannot -- what the thing does, the figures
   * behind the marks, the full rubric profile, what it connects to in the graph, and the
   * paper itself. For a topic, tool or repository it lists the builds that hang off it.
   */
  function describeNode(detail) {
    if (!detail) {
      selection.hidden = true;
      selection.replaceChildren();
      return;
    }
    const linked = byNode.get(detail.id) || [];
    const card = linked[0];
    const build = detail.type === "paper" && card ? rowData[card.dataset.slug] : null;
    const parts = [];

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const block = (label) => {
      const wrap = el("div", "selection-block");
      wrap.append(el("span", "selection-label", label));
      return wrap;
    };
    const nodeChip = (id, label, type) => {
      const chip = el("button", `chip chip--${type}`, label);
      chip.type = "button";
      chip.title = `${type} · select in the map`;
      chip.addEventListener("click", () => graph?.select?.(id));
      return chip;
    };

    if (build) {
      const kicker = [build.name !== build.title ? build.name : "", build.area, build.year].filter(Boolean).join(" · ");
      if (kicker) parts.push(el("p", "selection-kicker", kicker));

      // The title is the link, as on the card.
      const heading = el("p", "selection-title");
      const link = el("a", "", build.title);
      link.href = `/papers/${card.dataset.slug}`;
      heading.append(link);
      parts.push(heading);

      if (build.summary) parts.push(el("p", "selection-summary", build.summary));

      if (build.measured?.length) {
        const wrap = block("Measured");
        const dl = el("dl", "selection-stats");
        for (const m of build.measured) {
          const row = el("div");
          const dd = el("dd", "", m.value || "stated");
          dd.title = `${m.label}, as the paper states it`;
          row.append(el("dt", "", m.label), dd);
          dl.append(row);
        }
        wrap.append(dl);
        parts.push(wrap);
      }

      if (build.criteria?.length) {
        const wrap = block(
          build.criteriaAverage != null ? `Rubric · ${build.criteriaAverage.toFixed(1)} of 5` : "Rubric"
        );
        // Each bar is a button: selecting one prints the criterion, its score and the
        // curator's one-line rationale beneath the strip, so the detail is readable on
        // touch screens and by keyboard, not only in a hover tooltip.
        const strip = el("div", "selection-rubric");
        strip.setAttribute("role", "group");
        strip.setAttribute("aria-label", "Rubric scores; select a bar for its rationale");
        const detail = el("p", "rubric-detail", "Select a bar to read how it was scored.");
        detail.setAttribute("aria-live", "polite");
        const bars = [];
        for (const c of build.criteria) {
          const bar = el("button", "rubric-bar");
          bar.type = "button";
          bar.style.setProperty("--v", c.value == null ? 0 : c.value / 5);
          bar.setAttribute("aria-pressed", "false");
          bar.setAttribute("aria-label", `${c.name}: ${c.value == null ? "not scored" : `${c.value} of 5`}`);
          bar.title = `${c.name}: ${c.value ?? "not scored"}/5`;
          bar.addEventListener("click", () => {
            const wasOn = bar.getAttribute("aria-pressed") === "true";
            bars.forEach((b) => b.setAttribute("aria-pressed", "false"));
            if (wasOn) {
              detail.textContent = "Select a bar to read how it was scored.";
              detail.classList.remove("is-open");
              return;
            }
            bar.setAttribute("aria-pressed", "true");
            detail.replaceChildren(
              el("b", "", c.name),
              el("span", "", c.value == null ? " · not scored" : ` · ${c.value} of 5`),
              el("span", "rubric-detail-why", c.rationale ? ` — ${c.rationale}` : " — no rationale recorded")
            );
            detail.classList.add("is-open");
          });
          bars.push(bar);
          strip.append(bar);
        }
        wrap.append(strip, detail);
        parts.push(wrap);
      }

      if (build.links?.length) {
        const wrap = block("Connected to");
        const row = el("p", "selection-links");
        for (const n of build.links) row.append(nodeChip(n.id, n.label, n.type));
        wrap.append(row);
        parts.push(wrap);
      }

      if (build.doi || build.venue) {
        const wrap = block("Paper");
        const p = el("p", "selection-source");
        if (build.venue) p.append(el("span", "", build.venue), document.createTextNode(" · "));
        if (build.doi) {
          const a = el("a", "", build.doi);
          a.href = `https://doi.org/${build.doi}`;
          a.target = "_blank";
          a.rel = "noreferrer";
          p.append(a);
        }
        wrap.append(p);
        parts.push(wrap);
      }
    } else {
      parts.push(el("p", "selection-title", detail.label));
      parts.push(
        el("p", "selection-meta", `${detail.type} · ${linked.length} linked build${linked.length === 1 ? "" : "s"}`)
      );
      if (linked.length) {
        const wrap = block("Builds");
        const row = el("p", "selection-links");
        for (const c of linked.slice(0, 8)) {
          const data = rowData[c.dataset.slug];
          const paperId = (c.dataset.nodes || "").split(" ")[0];
          row.append(nodeChip(paperId, data?.name || data?.title || c.dataset.slug, "paper"));
        }
        if (linked.length > 8) row.append(el("span", "selection-more", `+${linked.length - 8} more`));
        wrap.append(row);
        parts.push(wrap);
      }
    }

    selection.replaceChildren(...parts);
    selection.hidden = false;
  }

  // Selecting a node describes it; it never prunes the list. A "Filter to this" button
  // used to live in the panel, and the data made it redundant: the nine topic nodes are
  // the nine Area facets, and 23 of 24 tools, every repository and every asset connect to
  // exactly one paper -- which the panel already links to by title.
  document.addEventListener("atlas:graph-select", (event) => {
    describeNode(event.detail ?? null);
    if (!event.detail) {
      markSelected(null);
      return;
    }
    const card = (byNode.get(event.detail.id) || [])[0];
    if (!card) return;
    markSelected(card.dataset.slug);
    if (!card.hidden && !restoring) {
      const target = currentView === "cards" ? card : listRows.find((r) => r.dataset.slug === card.dataset.slug);
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // Which of the two scripts initialises first is not guaranteed, so take the instance
  // whichever way it arrives: the event if the graph is still starting, the handle it
  // parks on the canvas if it has already finished.
  document.addEventListener("atlas:graph-ready", (event) => {
    graph = event.detail?.instance ?? null;
    apply();
  });

  function adoptExistingGraph() {
    const canvas = document.querySelector(".map-pane canvas");
    if (canvas?.atlasGraph) graph = canvas.atlasGraph;
  }

  // ---------------------------------------------------------------- card selection

  /**
   * One click inspects, two clicks open -- the same bargain the map makes.
   *
   * Only for a mouse. On a touch screen there is no hover to hint at it and no cheap way to
   * double-tap, so a tap opens the record as any list would. Modifier and middle clicks are
   * let through untouched: someone reaching for "open in a new tab" means it, and a keyboard
   * Enter on the title link is never intercepted at all, so keyboard users keep the plain
   * link behaviour.
   */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let selectedSlug = null;

  function markSelected(slug) {
    selectedSlug = slug;
    for (const el of [...cards, ...listRows]) {
      const on = el.dataset.slug === slug;
      el.classList.toggle("is-selected", on);
      const card = el.querySelector(".build-card") || el;
      if (card !== el) card.classList.toggle("is-selected", on);
    }
  }

  function inspectRow(el) {
    if (el.dataset.slug === selectedSlug) {
      markSelected(null);
      graph?.select?.(null);
      describeNode(null);
      return;
    }
    markSelected(el.dataset.slug);
    // Asking the map to select the node makes it dispatch atlas:graph-select, which fills
    // the selection card -- one path for both directions instead of two that can disagree.
    const id = el.dataset.paperId;
    if (id && graph?.select) graph.select(id);
    else describeNode({ id, type: "paper", label: el.dataset.sortTitle || "" });
  }

  function bindRowInteractions(container) {
    container.addEventListener("click", (event) => {
      // The title is a real link and behaves like one: clicking it opens the record. Only
      // the rest of the card inspects, which keeps the obvious gesture -- click the name --
      // doing the obvious thing.
      if (event.target.closest("a")) return;
      if (!finePointer.matches) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const row = event.target.closest("[data-row], [data-listrow]");
      if (!row || !container.contains(row)) return;
      event.preventDefault();
      inspectRow(row);
    });

    container.addEventListener("dblclick", (event) => {
      if (event.target.closest("a")) return;
      const row = event.target.closest("[data-row], [data-listrow]");
      if (!row || !container.contains(row)) return;
      event.preventDefault();
      // A double click leaves the word under the cursor selected on the page we are leaving.
      window.getSelection()?.removeAllRanges();
      window.location.assign(`/papers/${row.dataset.slug}`);
    });
  }

  bindRowInteractions(grid);
  if (listWrap) bindRowInteractions(listWrap);

  // ---------------------------------------------------------------- wiring

  search.addEventListener("input", apply);
  sortSelect.addEventListener("change", () => {
    applySort(sortSelect.value);
    writeUrl();
  });

  // Click a column title to sort by it. The first click takes the direction that answers
  // the question the column raises -- cheapest builds, most recent work, names from A --
  // and clicking the same column again reverses it.
  for (const button of sortButtons) {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      const flip = currentSort.startsWith(`${key}:`);
      const dir = flip
        ? currentSort.endsWith(":asc") ? "desc" : "asc"
        : DEFAULT_DIRECTION[key] || "asc";
      applySort(`${key}:${dir}`);
      writeUrl();
    });
  }

  for (const box of checkboxes) {
    box.addEventListener("change", () => {
      const set = active.get(box.dataset.facet);
      if (box.checked) set.add(box.value);
      else set.delete(box.value);
      apply();
    });
  }

  clearButton.addEventListener("click", () => {
    search.value = "";
    for (const set of active.values()) set.clear();
    for (const box of checkboxes) box.checked = false;
    apply();
    search.focus();
  });

  for (const button of document.querySelectorAll("[data-view-option]")) {
    button.addEventListener("click", () => setView(button.dataset.viewOption));
  }

  // Coming back to a wide window restores the choice; leaving one falls back to cards.
  wideEnoughForList.addEventListener("change", () => {
    if (!wideEnoughForList.matches) setView("cards", false);
    else {
      try {
        const saved = localStorage.getItem(VIEW_KEY);
        if (saved === "list") setView("list", false);
      } catch {
        /* private mode: stay on cards */
      }
    }
  });

  // Filter drawer, narrow screens only. Mirrors the mobile nav panel in BaseLayout.
  const facets = document.getElementById("atlas-facets");
  const filtersButton = document.getElementById("atlas-filters");
  const backdrop = document.getElementById("atlas-facets-backdrop");
  const closeButton = document.getElementById("atlas-facets-close");

  function setDrawer(open) {
    facets.dataset.open = String(open);
    filtersButton.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
    if (open) facets.querySelector("input")?.focus();
    else filtersButton.focus();
  }

  filtersButton?.addEventListener("click", () => setDrawer(facets.dataset.open !== "true"));
  closeButton?.addEventListener("click", () => setDrawer(false));
  backdrop?.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && facets.dataset.open === "true") setDrawer(false);
  });

  // ---------------------------------------------------------------- start

  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "list" || saved === "cards") setView(saved, false);
  } catch {
    /* private mode: fall back to cards */
  }
  readUrl();
  adoptExistingGraph();
  applySort(currentSort);
  apply();
  restoring = false;
}
