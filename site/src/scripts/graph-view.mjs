import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation
} from "d3-force";
import { initPagination } from "./pagination.mjs";

const PALETTE = {
  paper: "#0c6d62",
  tool: "#bb5a2a",
  topic: "#284f9e",
  repo: "#80612b",
  asset: "#5d4db8",
  event: "#a63f54"
};

const RELATION_LABELS = {
  belongs_to_topic: "Topic membership",
  in_topic: "In this topic",
  describes: "Describes",
  has_asset: "Build assets",
  implemented_by_repo: "Implemented by",
  contains_repo: "Repository",
  links_to_repo: "Linked repo",
  presented_at: "Presented at"
};

const NODE_RADIUS = {
  paper: 5.5,
  tool: 6.5,
  topic: 9,
  repo: 5.5,
  asset: 5.5
};

const NODE_OPACITY = {
  paper: 0.9,
  topic: 0.92,
  tool: 0.42,
  repo: 0.38,
  asset: 0.38
};

const WALL_PAD = 28;
const WALL_REPULSE_DEPTH = 110;
const WALL_REPULSE_STRENGTH = 0.45;
const CENTER_PULL = 0.14;

const PROFILES = {
  lite: { maxDpr: 1, interactFps: 20, reducedFps: 6, glow: 0.35 },
  balanced: { maxDpr: 1.25, interactFps: 30, reducedFps: 10, glow: 0.58 },
  high: { maxDpr: 1.5, interactFps: 36, reducedFps: 12, glow: 0.7 }
};

function getProfile() {
  const nav = navigator;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 8;
  const reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(prefers-reduced-data: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (reduced || coarse || cores <= 4 || memory <= 4 || window.innerWidth < 760) return PROFILES.lite;
  if (cores >= 8 && memory >= 8 && window.innerWidth >= 1100) return PROFILES.high;
  return PROFILES.balanced;
}

function hashEdge(a, b) {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return hash / 997;
}

export function initGraphView(graphData, options = {}) {
  const canvasEl = options.canvasEl || options.svgEl;
  const {
    nodeListEl,
    nodePaginationId,
    relationsEl,
    focusMetaEl,
    liveEl,
    countsEl,
    listCountEl,
    filterInput,
    criterionSelect,
    minScoreSelect,
    typeChips = [],
    selectionPanel,
    nodesPanel,
    syncUrl: shouldSyncUrl = true
  } = options;

  const NODE_LIST_PAGE_SIZE = 20;
  const RELATION_PAGE_SIZE = 5;
  let nodeListPaginator = null;
  let relationPageState = {};

  if (!canvasEl || canvasEl.dataset.graphInit === "true") return;
  canvasEl.dataset.graphInit = "true";

  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;

  const nodes = graphData.nodes.filter((n) => n.type !== "event");
  const excludedIds = new Set(
    graphData.nodes.filter((n) => n.type === "event").map((n) => n.id)
  );
  const edges = graphData.edges.filter(
    (e) => !excludedIds.has(e.source) && !excludedIds.has(e.target)
  );
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, { edges: [], ids: new Set() });
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, { edges: [], ids: new Set() });
    adjacency.get(edge.source).edges.push(edge);
    adjacency.get(edge.source).ids.add(edge.target);
    adjacency.get(edge.target).edges.push(edge);
    adjacency.get(edge.target).ids.add(edge.source);
  }
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("node");
  if (criterionSelect instanceof HTMLSelectElement && params.has("criterion")) {
    criterionSelect.value = params.get("criterion") || "";
  }
  if (minScoreSelect instanceof HTMLSelectElement && params.has("minScore")) {
    minScoreSelect.value = params.get("minScore") || "";
  }
  let activeId = nodes.some((n) => n.id === requested) ? requested : null;
  let hoveredId = null;
  let activeType = "";
  let sim = null;
  let graphNodes = [];
  let graphLinks = [];
  let graphNodeMap = new Map();
  let graphDrawNodes = [];
  let view = { k: 1, cx: 0, cy: 0, panX: 0, panY: 0 };
  let width = 1;
  let height = 1;
  let center = { x: 1, y: 1 };
  let profile = getProfile();
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let graphVisible = true;
  // Ids the page wants emphasised. null means "no external filter". The index sets this so
  // the map always shows the same set as the results beside it.
  let externalVisible = null;
  let pageVisible = !document.hidden;
  let frameId = null;
  let lastFrame = 0;
  let needsDraw = true;
  let clickTimer = null;
  let dragState = null;
  const edgeHash = new Map(edges.map((e) => [`${e.source}|${e.target}`, hashEdge(e.source, e.target)]));

  const nodeRadius = (node, focused = false) => (NODE_RADIUS[node.type] || 6.5) + (focused ? 2.5 : 0);

  const neighborsFor = (nodeId) => {
    const entry = adjacency.get(nodeId);
    if (!entry) return { edges: [], nodes: [] };
    return {
      edges: entry.edges,
      nodes: [...entry.ids].map((id) => nodesById.get(id)).filter(Boolean)
    };
  };

  const scoreContextIds = () => {
    const criterion = criterionSelect instanceof HTMLSelectElement ? criterionSelect.value : "";
    const minimumRaw = minScoreSelect instanceof HTMLSelectElement ? minScoreSelect.value : "";
    if (!criterion && !minimumRaw) return null;

    const minimum = Number(minimumRaw || 0);
    const qualifyingPapers = new Set(
      nodes
        .filter((node) => {
          if (node.type !== "paper") return false;
          const score = criterion ? node.criteriaScores?.[criterion] : node.criteriaAverage;
          return Number.isFinite(score) && score >= minimum;
        })
        .map((node) => node.id)
    );
    const context = new Set(qualifyingPapers);
    for (const edge of edges) {
      if (qualifyingPapers.has(edge.source)) context.add(edge.target);
      if (qualifyingPapers.has(edge.target)) context.add(edge.source);
    }
    return context;
  };

  const nodeMatchesControls = (node, { includeType = true } = {}) => {
    const q = filterInput instanceof HTMLInputElement ? filterInput.value.trim().toLowerCase() : "";
    const contextIds = scoreContextIds();
    const matchQ = !q || `${node.label} ${node.meta}`.toLowerCase().includes(q);
    const matchT = !includeType || !activeType || node.type === activeType;
    const matchScore = !contextIds || contextIds.has(node.id);
    return matchQ && matchT && matchScore;
  };

  const nodeMatchesScore = (node) => {
    const contextIds = scoreContextIds();
    return !contextIds || contextIds.has(node.id);
  };

  const addTopicContext = (node, ids) => {
    if (!node) return;
    ids.add(node.id);

    if (node.type === "paper") {
      for (const linkedId of adjacency.get(node.id)?.ids || []) {
        const linked = nodesById.get(linkedId);
        if (linked?.type === "topic") ids.add(linked.id);
      }
      return;
    }

    if (node.type === "topic") {
      for (const linkedId of adjacency.get(node.id)?.ids || []) {
        const linked = nodesById.get(linkedId);
        if (linked?.type === "paper" && nodeMatchesScore(linked)) {
          ids.add(linked.id);
        }
      }
      return;
    }

    if (node.type === "tool") {
      for (const linkedId of adjacency.get(node.id)?.ids || []) {
        const linked = nodesById.get(linkedId);
        if (linked?.type !== "paper" || !nodeMatchesScore(linked)) continue;
        for (const paperLinkedId of adjacency.get(linked.id)?.ids || []) {
          const paperLinked = nodesById.get(paperLinkedId);
          if (paperLinked?.type === "topic") ids.add(paperLinked.id);
        }
      }
      return;
    }

    for (const linkedId of adjacency.get(node.id)?.ids || []) {
      const linked = nodesById.get(linkedId);
      if (linked?.type !== "paper" || !nodeMatchesScore(linked)) continue;
      ids.add(linked.id);
      for (const paperLinkedId of adjacency.get(linked.id)?.ids || []) {
        const paperLinked = nodesById.get(paperLinkedId);
        if (paperLinked?.type === "topic") ids.add(paperLinked.id);
      }
    }
  };

  const visibleNodes = () => {
    if (!activeType) return nodes.filter((n) => nodeMatchesControls(n));

    const seedNodes = nodes.filter((n) => nodeMatchesControls(n));
    const ids = new Set();
    for (const node of seedNodes) addTopicContext(node, ids);
    return nodes.filter((n) => ids.has(n.id));
  };

  const visibleEdges = (nodeIds) => {
    const ids = new Set(nodeIds);
    const directEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    if (activeType !== "tool") return directEdges;

    const edgeKeys = new Set(directEdges.map((e) => `${e.source}|${e.target}`));
    const inferredEdges = [];
    for (const tool of nodes.filter((node) => node.type === "tool" && ids.has(node.id))) {
      for (const linkedId of adjacency.get(tool.id)?.ids || []) {
        const paper = nodesById.get(linkedId);
        if (paper?.type !== "paper" || !nodeMatchesScore(paper)) continue;
        for (const topicId of adjacency.get(paper.id)?.ids || []) {
          const topic = nodesById.get(topicId);
          if (topic?.type !== "topic" || !ids.has(topic.id)) continue;
          const key = `${tool.id}|${topic.id}`;
          if (edgeKeys.has(key)) continue;
          edgeKeys.add(key);
          inferredEdges.push({
            source: tool.id,
            target: topic.id,
            relation: "inferred_topic"
          });
        }
      }
    }
    return [...directEdges, ...inferredEdges];
  };

  const syncUrl = () => {
    if (!shouldSyncUrl) return;
    const url = new URL(window.location.href);
    if (activeId) url.searchParams.set("node", activeId);
    else url.searchParams.delete("node");
    const criterion = criterionSelect instanceof HTMLSelectElement ? criterionSelect.value : "";
    const minimum = minScoreSelect instanceof HTMLSelectElement ? minScoreSelect.value : "";
    if (criterion) url.searchParams.set("criterion", criterion);
    else url.searchParams.delete("criterion");
    if (minimum) url.searchParams.set("minScore", minimum);
    else url.searchParams.delete("minScore");
    window.history.replaceState({}, "", url);
  };

  const updateCounts = () => {
    const visible = visibleNodes();
    const ids = new Set(visible.map((n) => n.id));
    const edgeCount = visibleEdges([...ids]).length;
    if (countsEl) countsEl.textContent = `${visible.length} nodes · ${edgeCount} edges`;
    if (listCountEl) {
      listCountEl.textContent = String(visible.length);
    }
  };

  const relationLabel = (relation) =>
    RELATION_LABELS[relation] ||
    relation.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const typeMarkup = (type) =>
    `<span class="graph-type-mark" style="--mark-color:${PALETTE[type] || "#576267"}" aria-hidden="true"></span>`;

  const topicChipMarkup = (node, { limit = 3, compact = false } = {}) => {
    const topicNames = Array.isArray(node.topicNames) ? node.topicNames.filter(Boolean) : [];
    if (topicNames.length === 0 || node.type === "topic") return "";
    const visible = topicNames.slice(0, limit);
    const extra = topicNames.length - visible.length;
    return `
      <div class="graph-topic-chips ${compact ? "graph-topic-chips--compact" : ""}" aria-label="Connected topics">
        ${visible.map((topic) => `<span class="graph-topic-chip">${escapeHtml(topic)}</span>`).join("")}
        ${extra > 0 ? `<span class="graph-topic-chip graph-topic-chip--muted">+${extra}</span>` : ""}
      </div>`;
  };

  const selectNode = (id, fromList = false) => {
    const prevId = activeId;
    activeId = id && nodes.find((n) => n.id === id) ? id : null;
    if (prevId !== activeId) relationPageState = {};
    syncUrl();
    renderList({ resetPage: false });
    renderInspector();
    markDirty();
    wakeSimulation();
    if (selectionPanel instanceof HTMLDetailsElement && activeId) {
      selectionPanel.open = true;
    }
    if (fromList && activeId) {
      const btn = nodeListEl?.querySelector(`[data-node-id="${activeId}"]`);
      btn?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    }
    if (!fromList && activeId && nodesPanel instanceof HTMLDetailsElement) {
      nodesPanel.open = false;
    }
    // Announce the selection so a host page can react (the homepage filters its index
    // to the selected node). Pages that do not listen are unaffected.
    const selected = activeId ? nodes.find((n) => n.id === activeId) : null;
    canvasEl?.dispatchEvent(
      new CustomEvent("atlas:graph-select", {
        bubbles: true,
        detail: selected ? { id: selected.id, type: selected.type, label: selected.label } : null
      })
    );
    if (fromList && activeId && nodesPanel instanceof HTMLDetailsElement) {
      nodesPanel.open = true;
    }
  };

  const openNode = (id) => {
    const node = nodes.find((n) => n.id === id);
    if (node?.url) window.location.assign(node.url);
  };

  const renderNodeListPage = (pageNodes) => {
    if (!nodeListEl) return;
    if (pageNodes.length === 0) {
      nodeListEl.innerHTML = `<p class="muted graph-empty">No nodes match the current filters.</p>`;
      return;
    }
    nodeListEl.innerHTML = pageNodes
      .map(
        (n) => `
        <button type="button" class="graph-node-row ${n.id === activeId ? "is-active" : ""}" data-node-id="${n.id}">
          ${typeMarkup(n.type)}
          <span class="graph-node-row-text">
            <span class="graph-node-row-type">${escapeHtml(n.type)}</span>
            <strong class="graph-node-row-title">${escapeHtml(n.label)}</strong>
            ${n.meta ? `<span class="graph-node-row-meta muted">${escapeHtml(truncate(n.meta, 56))}</span>` : ""}
            ${topicChipMarkup(n, { limit: 2, compact: true })}
          </span>
        </button>`
      )
      .join("");
    nodeListEl.querySelectorAll("[data-node-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectNode(btn.getAttribute("data-node-id"), true));
    });
  };

  const renderList = ({ resetPage = false } = {}) => {
    if (!nodeListEl) return;
    const visible = visibleNodes();
    if (!nodeListPaginator && nodePaginationId) {
      nodeListPaginator = initPagination({
        navId: nodePaginationId,
        pageSize: NODE_LIST_PAGE_SIZE,
        pageParam: "nodesPage",
        getItems: () => visibleNodes(),
        onPageChange: ({ items }) => renderNodeListPage(items)
      });
    }
    if (nodeListPaginator) {
      if (resetPage) nodeListPaginator.reset();
      else nodeListPaginator.refresh();
    } else {
      renderNodeListPage(visible.slice(0, NODE_LIST_PAGE_SIZE));
    }
  };

  const renderLinkRow = (n) => `
    <button type="button" class="graph-link-row" data-node-id="${n.id}">
      ${typeMarkup(n.type)}
      <span class="graph-link-row-text">
        <strong>${escapeHtml(truncate(n.label, 52))}</strong>
        ${n.meta ? `<span class="muted">${escapeHtml(truncate(n.meta, 40))}</span>` : `<span class="muted">${escapeHtml(n.type)}</span>`}
        ${topicChipMarkup(n, { limit: 2, compact: true })}
      </span>
    </button>`;

  const bindRelationLinks = () => {
    relationsEl?.querySelectorAll("[data-node-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectNode(btn.getAttribute("data-node-id"), true));
    });
    relationsEl?.querySelectorAll("[data-relation-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rel = btn.getAttribute("data-relation");
        const page = Number.parseInt(btn.getAttribute("data-relation-page") || "1", 10);
        if (rel && activeId) {
          relationPageState[`${activeId}:${rel}`] = page;
          renderInspector();
        }
      });
    });
  };

  const renderRelationPagination = (rel, list, page) => {
    const totalPages = Math.max(1, Math.ceil(list.length / RELATION_PAGE_SIZE));
    if (totalPages <= 1) return "";
    const prevDisabled = page <= 1 ? " disabled" : "";
    const nextDisabled = page >= totalPages ? " disabled" : "";
    return `
      <div class="graph-relation-pagination pagination">
        <button type="button" class="pagination-btn pagination-prev" data-relation="${escapeHtml(rel)}" data-relation-page="${page - 1}" aria-label="Previous linked records"${prevDisabled}>Prev</button>
        <span class="pagination-summary">${page} / ${totalPages}</span>
        <button type="button" class="pagination-btn pagination-next" data-relation="${escapeHtml(rel)}" data-relation-page="${page + 1}" aria-label="Next linked records"${nextDisabled}>Next</button>
      </div>`;
  };

  const renderInspector = () => {
    const focus = activeId ? nodes.find((n) => n.id === activeId) : null;
    if (!focus) {
      if (focusMetaEl) {
        focusMetaEl.innerHTML = `<p class="graph-inspector-empty muted">Click a node in the graph or list to inspect linked records. Double-click a node to open its page.</p>`;
      }
      if (relationsEl) relationsEl.innerHTML = "";
      if (liveEl) liveEl.textContent = "";
      return;
    }
    const nb = neighborsFor(focus.id);
    if (focusMetaEl) {
      const selectedCriterion = criterionSelect instanceof HTMLSelectElement ? criterionSelect.value : "";
      const selectedCriterionLabel = criterionSelect instanceof HTMLSelectElement
        ? criterionSelect.selectedOptions[0]?.textContent || ""
        : "";
      const selectedScore = selectedCriterion ? focus.criteriaScores?.[selectedCriterion] : focus.criteriaAverage;
      const scoreMarkup = focus.type === "paper" && Number.isFinite(selectedScore)
        ? `<p class="graph-focus-score"><strong>${escapeHtml(String(selectedScore))} / 5</strong><span>${escapeHtml(selectedCriterionLabel || "Assessment average")}</span></p>`
        : "";
      focusMetaEl.innerHTML = `
        <div class="graph-focus-card">
          <div class="graph-focus-head">
            <span class="graph-type-badge" style="--mark-color:${PALETTE[focus.type] || "#576267"}">${escapeHtml(focus.type)}</span>
            <h2>${escapeHtml(focus.label)}</h2>
            ${focus.meta ? `<p class="graph-focus-meta muted">${escapeHtml(focus.meta)}</p>` : ""}
            ${topicChipMarkup(focus, { limit: 5 })}
            ${scoreMarkup}
          </div>
          <a class="button-link secondary graph-focus-cta" href="${focus.url}">Open record</a>
        </div>`;
    }
    if (relationsEl) {
      if (nb.edges.length === 0) {
        relationsEl.innerHTML = `<p class="graph-relations-empty muted">No linked records in the corpus.</p>`;
      } else {
        const groups = {};
        for (const edge of nb.edges) {
          const otherId = edge.source === focus.id ? edge.target : edge.source;
          const other = nodes.find((n) => n.id === otherId);
          if (!other) continue;
          if (!groups[edge.relation]) groups[edge.relation] = [];
          groups[edge.relation].push(other);
        }
        relationsEl.innerHTML = Object.entries(groups)
          .map(([rel, list]) => {
            const pageKey = `${focus.id}:${rel}`;
            const totalPages = Math.max(1, Math.ceil(list.length / RELATION_PAGE_SIZE));
            const page = Math.min(relationPageState[pageKey] || 1, totalPages);
            relationPageState[pageKey] = page;
            const start = (page - 1) * RELATION_PAGE_SIZE;
            const pageList = list.slice(start, start + RELATION_PAGE_SIZE);
            return `
            <div class="graph-relation-group" data-relation="${escapeHtml(rel)}">
              <h4 class="graph-relation-label">${escapeHtml(relationLabel(rel))} <span class="muted">(${list.length})</span></h4>
              <div class="graph-link-list">
                ${pageList.map((n) => renderLinkRow(n)).join("")}
              </div>
              ${renderRelationPagination(rel, list, page)}
            </div>`;
          })
          .join("");
        bindRelationLinks();
      }
    }
    if (liveEl) {
      liveEl.textContent =
        nb.nodes.length > 0
          ? `${nb.nodes.length} linked record${nb.nodes.length === 1 ? "" : "s"} · double-click node to open`
          : "";
    }
  };

  const isNeighbor = (id) => {
    if (!activeId) return false;
    return adjacency.get(activeId)?.ids.has(id) || false;
  };

  const linkedIds = () => {
    if (!activeId && !hoveredId) return new Set();
    const focus = activeId || hoveredId;
    return adjacency.get(focus)?.ids || new Set();
  };

  const stopSimulation = () => {
    if (!sim) return;
    sim.on("tick", null);
    sim.stop();
    sim = null;
  };

  const wakeSimulation = () => {
    if (!sim || reducedMotion) return;
    sim.alphaTarget(0).alpha(Math.max(sim.alpha(), 0.16)).restart();
    markDirty();
  };

  const resetView = () => {
    view = { k: 1, cx: center.x, cy: center.y, panX: 0, panY: 0 };
  };

  const computeFit = () => {
    resetView();
  };

  const toScreen = (x, y) => ({
    x: (x - view.cx) * view.k + width / 2 + view.panX,
    y: (y - view.cy) * view.k + height / 2 + view.panY
  });

  const toWorld = (sx, sy) => ({
    x: (sx - width / 2 - view.panX) / view.k + view.cx,
    y: (sy - height / 2 - view.panY) / view.k + view.cy
  });

  const nodeScreenPos = (node) => {
    const r = (node.r || nodeRadius(node)) + 4;
    return {
      sx: (node.x - view.cx) * view.k + width / 2 + view.panX,
      sy: (node.y - view.cy) * view.k + height / 2 + view.panY,
      r,
      minX: WALL_PAD + r,
      maxX: width - WALL_PAD - r,
      minY: WALL_PAD + r,
      maxY: height - WALL_PAD - r
    };
  };

  const screenToNode = (sx, sy) => ({
    x: (sx - width / 2 - view.panX) / view.k + view.cx,
    y: (sy - height / 2 - view.panY) / view.k + view.cy
  });

  const applyWallRepulsion = (node) => {
    if (dragState?.node === node) return;

    const { sx, sy, minX, maxX, minY, maxY } = nodeScreenPos(node);
    const depth = WALL_REPULSE_DEPTH;
    const scale = WALL_REPULSE_STRENGTH / (view.k || 1);
    let ax = 0;
    let ay = 0;

    const repulse = (dist, dir) => {
      const t = 1 - Math.min(1, Math.max(0, dist) / depth);
      return t * t * scale * dir;
    };

    if (sx < minX + depth) ax += repulse(sx - minX, 1);
    if (sx > maxX - depth) ax += repulse(maxX - sx, -1);
    if (sy < minY + depth) ay += repulse(sy - minY, 1);
    if (sy > maxY - depth) ay += repulse(maxY - sy, -1);

    node.vx += ax;
    node.vy += ay;

    const anchor = screenToNode(width / 2, height / 2);
    const dx = anchor.x - node.x;
    const dy = anchor.y - node.y;
    const dist = Math.hypot(dx, dy) || 1;
    const softRadius = Math.min(width, height) * 0.22;
    if (dist > softRadius) {
      const pull = Math.min(1, (dist - softRadius) / softRadius) * CENTER_PULL;
      node.vx += (dx / dist) * pull;
      node.vy += (dy / dist) * pull;
    }
  };

  const enforceWallSafety = (node) => {
    const { sx, sy, minX, maxX, minY, maxY } = nodeScreenPos(node);
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) return;

    const target = screenToNode(
      Math.min(maxX, Math.max(minX, sx)),
      Math.min(maxY, Math.max(minY, sy))
    );
    node.x += (target.x - node.x) * 0.22;
    node.y += (target.y - node.y) * 0.22;
    if (node.fx != null) node.fx = node.x;
    if (node.fy != null) node.fy = node.y;
    if (sx < minX && node.vx < 0) node.vx = 0;
    if (sx > maxX && node.vx > 0) node.vx = 0;
    if (sy < minY && node.vy < 0) node.vy = 0;
    if (sy > maxY && node.vy > 0) node.vy = 0;
  };

  const applyWallForces = () => {
    for (const node of graphNodes) {
      applyWallRepulsion(node);
      enforceWallSafety(node);
    }
  };

  const resize = () => {
    const rect = canvasEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);
    canvasEl.width = Math.floor(width * dpr);
    canvasEl.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    center = { x: width / 2, y: height / 2 };
    resetView();
    if (sim) {
      sim.force("center", forceCenter(center.x, center.y).strength(0.12));
      sim.alpha(0.2).restart();
    }
    markDirty();
    draw();
    scheduleLoop();
  };

  const cacheDrawState = () => {
    const drawOrder = { paper: 0, asset: 1, repo: 1, tool: 3, topic: 4 };
    graphNodeMap = new Map(graphNodes.map((n) => [n.id, n]));
    graphDrawNodes = [...graphNodes].sort((a, b) => (drawOrder[a.type] ?? 2) - (drawOrder[b.type] ?? 2));
  };

  const buildSimulation = () => {
    stopSimulation();
    const visible = visibleNodes();
    updateCounts();
    if (visible.length === 0) {
      graphNodes = [];
      graphLinks = [];
      graphNodeMap = new Map();
      graphDrawNodes = [];
      markDirty();
      return;
    }

    const ids = visible.map((n) => n.id);
    graphLinks = visibleEdges(ids);
    const prev = new Map(graphNodes.map((n) => [n.id, n]));

    graphNodes = visible.map((n) => {
      const existing = prev.get(n.id);
      return {
        ...n,
        r: nodeRadius(n, n.id === activeId),
        x: existing?.x ?? center.x + (Math.random() - 0.5) * 36,
        y: existing?.y ?? center.y + (Math.random() - 0.5) * 36,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null
      };
    });

    if (reducedMotion || graphNodes.length <= 1) {
      graphNodes.forEach((n, i) => {
        const angle = (Math.PI * 2 * i) / graphNodes.length;
        const r = Math.min(180, 50 + graphNodes.length * 2.2);
        n.x = center.x + Math.cos(angle) * r;
        n.y = center.y + Math.sin(angle) * r;
        n.fx = n.x;
        n.fy = n.y;
      });
      computeFit();
      cacheDrawState();
      markDirty();
      return;
    }

    resetView();
    const nodeById = new Map(graphNodes.map((n) => [n.id, n]));
    const links = graphLinks
      .map((e) => ({ source: nodeById.get(e.source), target: nodeById.get(e.target), relation: e.relation }))
      .filter((l) => l.source && l.target);

    const charge = graphNodes.length > 80 ? -22 : -32;
    sim = forceSimulation(graphNodes)
      .velocityDecay(0.55)
      .alphaDecay(0.03)
      .alphaMin(0.001)
      .alphaTarget(0)
      .force("charge", forceManyBody().strength(charge).distanceMax(220))
      .force("center", forceCenter(center.x, center.y).strength(0.12))
      .force(
        "link",
        forceLink(links)
          .id((d) => d.id)
          .distance((l) => (l.source.type === "topic" || l.target.type === "topic" ? 58 : 44))
          .strength(0.42)
      )
      .force("collide", forceCollide().radius((d) => d.r + 5).strength(0.85).iterations(1));

    sim.alpha(0.65).restart();
    cacheDrawState();
    markDirty();

    let settleTicks = 0;
    sim.on("tick", () => {
      applyWallForces();
      settleTicks += 1;
      if (settleTicks === 90) computeFit();
      markDirty();
    });
  };

  const hexToRgb = (hex) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  };

  const draw = (timestamp = 0) => {
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width * 0.45,
      height * 0.48,
      12,
      width * 0.45,
      height * 0.48,
      width * 0.62
    );
    gradient.addColorStop(0, "rgba(12, 109, 98, 0.08)");
    gradient.addColorStop(0.55, "rgba(40, 79, 158, 0.05)");
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (graphNodes.length === 0) {
      ctx.fillStyle = "#576267";
      ctx.font = "400 14px D-DIN, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No nodes match filters", width / 2, height / 2);
      return;
    }

    const focusLinks = linkedIds();
    const time = dragState && !reducedMotion ? timestamp : 0;

    for (const edge of graphLinks) {
      const a = graphNodeMap.get(edge.source);
      const b = graphNodeMap.get(edge.target);
      if (!a || !b) continue;
      const sa = toScreen(a.x, a.y);
      const sb = toScreen(b.x, b.y);
      const active =
        edge.source === activeId ||
        edge.target === activeId ||
        edge.source === hoveredId ||
        edge.target === hoveredId;
      const dimmed = activeId && !active;
      const hash = edgeHash.get(`${edge.source}|${edge.target}`) ?? hashEdge(edge.source, edge.target);
      const midX = (sa.x + sb.x) / 2;
      const midY = (sa.y + sb.y) / 2;
      const dx = sb.x - sa.x;
      const dy = sb.y - sa.y;
      const dist = Math.hypot(dx, dy) || 1;
      const curveDir = hash > 0.5 ? 1 : -1;
      const curve =
        curveDir *
        (18 + Math.min(dist, 180) * 0.05) *
        (0.8 + Math.sin(time * 0.0007 + hash * Math.PI * 2) * 0.14);
      const cx = midX + (-dy / dist) * curve;
      const cy = midY + (dx / dist) * curve;

      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.quadraticCurveTo(cx, cy, sb.x, sb.y);
      ctx.strokeStyle = active
        ? "rgba(12, 109, 98, 0.75)"
        : dimmed
          ? "rgba(24, 33, 38, 0.06)"
          : "rgba(24, 33, 38, 0.14)";
      ctx.lineWidth = active ? 2 : 1;
      ctx.stroke();

    }

    for (const node of graphDrawNodes) {
      const p = toScreen(node.x, node.y);
      const isActive = node.id === activeId;
      const isHovered = node.id === hoveredId;
      const isLinked = focusLinks.has(node.id);
      const outside = externalVisible !== null && !externalVisible.has(node.id);
      const dimmed =
        outside || (activeId && !isActive && !isHovered && !isLinked && !isNeighbor(node.id));
      const r = nodeRadius(node, isActive);
      const color = PALETTE[node.type] || "#576267";
      const glow = profile.glow;
      const baseAlpha = NODE_OPACITY[node.type] ?? 0.75;

      if (node.type === "topic" || isActive || isLinked) {
        const haloR = r + (node.type === "topic" ? 28 : 16) + (isActive ? 8 : 0);
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
        const alpha = (isActive ? 0.22 : isLinked ? 0.16 : 0.1) * glow;
        halo.addColorStop(0, `rgba(${hexToRgb(color)}, ${alpha})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r + (isActive || isHovered ? 5 : 3), 0, Math.PI * 2);
      const ringAlpha = isActive ? 0.22 : isHovered ? 0.14 : 0.08;
      ctx.fillStyle = isActive
        ? `rgba(${hexToRgb(color)}, ${ringAlpha})`
        : isHovered
          ? `rgba(${hexToRgb(color)}, ${ringAlpha})`
          : `rgba(${hexToRgb(color)}, ${ringAlpha * baseAlpha})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = outside ? baseAlpha * 0.12 : dimmed ? baseAlpha * 0.4 : baseAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive
        ? "#284f9e"
        : isHovered
          ? "#0c6d62"
          : `rgba(255,255,255,${baseAlpha > 0.5 ? 0.85 : 0.45})`;
      ctx.lineWidth = isActive ? 2 : isHovered ? 1.6 : baseAlpha > 0.5 ? 1.1 : 0.8;
      ctx.stroke();

      if (isActive || isHovered || node.type === "topic") {
        const label = truncate(node.label, node.type === "topic" ? 28 : 22);
        const fontSize = node.type === "topic" ? 11 : 10;
        ctx.font = `700 ${fontSize}px D-DIN, system-ui, sans-serif`;
        const metrics = ctx.measureText(label);
        const padX = 5;
        const pillW = metrics.width + padX * 2;
        const pillH = 15;
        const pillX = p.x - pillW / 2;
        const pillY = p.y + r + 7;
        ctx.fillStyle = isActive ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.78)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 2);
        ctx.fill();
        ctx.strokeStyle = isActive ? "rgba(12, 109, 98, 0.45)" : "rgba(24, 33, 38, 0.12)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = "#182126";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, p.x, pillY + pillH / 2 + 0.5);
      }
    }
  };

  const nearestNode = (clientX, clientY) => {
    const rect = canvasEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    let nearest = null;
    let nearestDist = Infinity;
    for (const node of graphNodes) {
      const p = toScreen(node.x, node.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      const hit = nodeRadius(node) + 10;
      if (d < hit && d < nearestDist) {
        nearest = node;
        nearestDist = d;
      }
    }
    return nearest;
  };

  const stopLoop = () => {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const simulationActive = () => Boolean(sim && sim.alpha() > sim.alphaMin());

  const markDirty = () => {
    needsDraw = true;
    scheduleLoop();
  };

  const scheduleLoop = () => {
    if (!graphVisible || !pageVisible || frameId) return;
    frameId = requestAnimationFrame(step);
  };

  const step = (timestamp) => {
    frameId = null;
    if (!graphVisible || !pageVisible) return;

    const interacting = Boolean(dragState || hoveredId || activeId);
    const targetFps = reducedMotion
      ? profile.reducedFps
      : needsDraw || interacting || simulationActive()
        ? profile.interactFps
        : 1;
    const minFrame = 1000 / targetFps;
    if (timestamp - lastFrame < minFrame) {
      scheduleLoop();
      return;
    }
    lastFrame = timestamp;
    if (needsDraw || simulationActive()) {
      draw(timestamp);
      needsDraw = false;
    }
    if (dragState || simulationActive()) scheduleLoop();
  };

  const applyFilters = () => {
    const visible = visibleNodes();
    if (activeId && !visible.some((n) => n.id === activeId)) {
      activeId = null;
      syncUrl();
    }
    renderList({ resetPage: true });
    buildSimulation();
    renderInspector();
    scheduleLoop();
  };

  const bindCanvasEvents = () => {
    if (canvasEl.dataset.graphBound === "true") return;
    canvasEl.dataset.graphBound = "true";

    const endDrag = () => {
      if (dragState?.mode === "node" && dragState.node) {
        dragState.node.fx = null;
        dragState.node.fy = null;
        wakeSimulation();
      }
      dragState = null;
      canvasEl.classList.remove("is-panning");
      canvasEl.style.cursor = hoveredId ? "grab" : "default";
    };

    canvasEl.addEventListener("pointerdown", (e) => {
      const node = nearestNode(e.clientX, e.clientY);
      if (node) {
        e.preventDefault();
        const rect = canvasEl.getBoundingClientRect();
        const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        dragState = {
          mode: "node",
          node,
          pointerId: e.pointerId,
          moved: false,
          offsetX: world.x - node.x,
          offsetY: world.y - node.y
        };
        node.fx = node.x;
        node.fy = node.y;
        canvasEl.setPointerCapture(e.pointerId);
        canvasEl.style.cursor = "grabbing";
        wakeSimulation();
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      dragState = {
        mode: "pan",
        pointerId: e.pointerId,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        panX: view.panX,
        panY: view.panY
      };
      canvasEl.classList.add("is-panning");
      canvasEl.setPointerCapture(e.pointerId);
    });

    canvasEl.addEventListener("pointermove", (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) {
        const hit = nearestNode(e.clientX, e.clientY);
        if (hit?.id !== hoveredId) {
          hoveredId = hit?.id ?? null;
          markDirty();
        }
        canvasEl.style.cursor = hit ? "grab" : dragState ? "grabbing" : "default";
        return;
      }

      if (dragState.mode === "pan") {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragState.moved = true;
        view.panX = dragState.panX + dx;
        view.panY = dragState.panY + dy;
        markDirty();
        return;
      }

      if (dragState.mode === "node" && dragState.node) {
        const rect = canvasEl.getBoundingClientRect();
        const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        dragState.node.x = world.x - dragState.offsetX;
        dragState.node.y = world.y - dragState.offsetY;
        dragState.node.fx = dragState.node.x;
        dragState.node.fy = dragState.node.y;
        enforceWallSafety(dragState.node);
        if (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1) dragState.moved = true;
        markDirty();
      }
    });

    canvasEl.addEventListener("pointerup", (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const wasDrag = dragState.moved;
      const node = dragState.mode === "node" ? dragState.node : nearestNode(e.clientX, e.clientY);
      endDrag();
      if (!wasDrag && node) {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          selectNode(node.id, false);
          clickTimer = null;
        }, 200);
      } else if (!wasDrag && !node) {
        selectNode(null, false);
      }
    });

    canvasEl.addEventListener("pointerleave", () => {
      hoveredId = null;
      markDirty();
    });

    canvasEl.addEventListener("dblclick", (e) => {
      const node = nearestNode(e.clientX, e.clientY);
      if (!node) return;
      e.preventDefault();
      clearTimeout(clickTimer);
      openNode(node.id);
    });
  };

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      // A zero-height box means layout has not settled yet, not that the graph is off
      // screen; acting on it would stop the loop before the first frame.
      if (!entry?.isIntersecting && entry?.boundingClientRect.height === 0) return;
      graphVisible = Boolean(entry?.isIntersecting);
      if (graphVisible) scheduleLoop();
      else stopLoop();
    },
    { threshold: 0.08 }
  );

  const onVisibility = () => {
    pageVisible = !document.hidden;
    if (pageVisible) scheduleLoop();
    else stopLoop();
  };

  const onProfileChange = () => {
    profile = getProfile();
    resize();
    scheduleLoop();
  };

  filterInput?.addEventListener("input", applyFilters);
  criterionSelect?.addEventListener("change", () => {
    syncUrl();
    applyFilters();
  });
  minScoreSelect?.addEventListener("change", () => {
    syncUrl();
    applyFilters();
  });
  typeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.type || "";
      const pressed = chip.getAttribute("aria-pressed") === "true";
      typeChips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      activeType = pressed ? "" : type;
      if (!pressed) chip.setAttribute("aria-pressed", "true");
      applyFilters();
    });
  });

  bindCanvasEvents();
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasEl);
  visibilityObserver.observe(canvasEl);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onProfileChange);

  applyFilters();
  scheduleLoop();
  if (activeId) selectNode(activeId, false);

  // Paint once, synchronously, before anything asynchronous can intervene. The render loop
  // is gated on an IntersectionObserver whose first callback is asynchronous; if it reports
  // "not intersecting" while layout is still settling, nothing would draw until the next
  // intersection change and the canvas would sit there empty.
  draw();
  const markReadyWhenDrawn = () => {
    if (canvasEl.dataset.graphReady === "true") return;
    const laidOut = graphDrawNodes.some(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y) && (node.x !== 0 || node.y !== 0)
    );
    if (laidOut) {
      canvasEl.dataset.graphReady = "true";
      return;
    }
    requestAnimationFrame(markReadyWhenDrawn);
  };
  markReadyWhenDrawn();

  const instance = {
    /** ids to emphasise, or null to clear the external filter */
    setVisible(ids) {
      externalVisible = ids instanceof Set ? ids : null;
      markDirty();
      scheduleLoop();
    },
    select: (id) => selectNode(id, false),
    destroy: () => teardown()
  };
  if (canvasEl) canvasEl.atlasGraph = instance;
  canvasEl?.dispatchEvent(
    new CustomEvent("atlas:graph-ready", { bubbles: true, detail: { instance } })
  );

  const teardown = () => {
    stopLoop();
    stopSimulation();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onProfileChange);
  };

  return teardown;
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
