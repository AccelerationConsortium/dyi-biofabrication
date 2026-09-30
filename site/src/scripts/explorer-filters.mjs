/**
 * Generic client-side explorer filtering with URL sync and pagination.
 */
import { formatPagedCount, initPagination } from "./pagination.mjs";

export function initExplorer({
  filterId,
  itemSelector,
  getSearchText,
  filters = [],
  toggles = [],
  pageSize = 24
}) {
  const searchInput = document.getElementById(`${filterId}-search`);
  const countEl = document.getElementById(`${filterId}-count`);
  const clearBtn = document.getElementById(`${filterId}-clear`);
  const emptyEl = document.getElementById("explorer-empty");
  const items = [...document.querySelectorAll(itemSelector)];

  const params = new URLSearchParams(window.location.search);
  let matchedItems = items;
  let paginator = null;

  const readUrl = () => {
    if (searchInput instanceof HTMLInputElement && params.has("q")) {
      searchInput.value = params.get("q") || "";
    }
    for (const f of filters) {
      const el = document.getElementById(f.id);
      if (el instanceof HTMLSelectElement && params.has(f.param)) {
        el.value = params.get(f.param) || "";
        const root = el.closest("[data-select-root]");
        const selectedLabel = el.selectedOptions[0]?.textContent?.trim() || "";
        const valueEl = root?.querySelector("[data-select-value]");
        if (valueEl) valueEl.textContent = selectedLabel;
        for (const option of root?.querySelectorAll(".select-option") || []) {
          option.setAttribute("aria-selected", option.getAttribute("data-value") === el.value ? "true" : "false");
        }
      }
    }
    for (const t of toggles) {
      const el = document.getElementById(t.id);
      if (el instanceof HTMLInputElement && params.get(t.param) === "1") {
        el.checked = true;
      }
    }
  };

  const buildUrlParams = () => {
    const next = new URLSearchParams();
    const q = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : "";
    if (q) next.set("q", q);
    for (const f of filters) {
      const el = document.getElementById(f.id);
      if (el instanceof HTMLSelectElement && el.value) next.set(f.param, el.value);
    }
    for (const t of toggles) {
      const el = document.getElementById(t.id);
      if (el instanceof HTMLInputElement && el.checked) next.set(t.param, "1");
    }
    return next;
  };

  const writeUrl = (page = paginator?.page ?? 1) => {
    const next = buildUrlParams();
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  };

  const hasActiveFilters = () => {
    const q = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : "";
    if (q) return true;
    for (const f of filters) {
      const el = document.getElementById(f.id);
      if (el instanceof HTMLSelectElement && el.value) return true;
    }
    for (const t of toggles) {
      const el = document.getElementById(t.id);
      if (el instanceof HTMLInputElement && el.checked) return true;
    }
    return false;
  };

  const clearAll = () => {
    if (searchInput instanceof HTMLInputElement) searchInput.value = "";
    for (const f of filters) {
      const el = document.getElementById(f.id);
      if (el instanceof HTMLSelectElement) el.value = "";
    }
    for (const t of toggles) {
      const el = document.getElementById(t.id);
      if (el instanceof HTMLInputElement) el.checked = false;
    }
    apply({ resetPage: true });
  };

  const matchItem = (item) => {
    const q = searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : "";
    const search = getSearchText(item);
    let matches = !q || search.includes(q);

    for (const f of filters) {
      const el = document.getElementById(f.id);
      const val = el instanceof HTMLSelectElement ? el.value : "";
      if (val && !f.match(item, val)) matches = false;
    }
    for (const t of toggles) {
      const el = document.getElementById(t.id);
      const on = el instanceof HTMLInputElement ? el.checked : false;
      if (on && !t.match(item)) matches = false;
    }

    return matches;
  };

  const collectMatches = () => items.filter((item) => matchItem(item));

  const showPage = ({ page, items: pageItems, totalItems }) => {
    const visibleSet = new Set(pageItems);
    for (const item of items) {
      item.toggleAttribute("hidden", !visibleSet.has(item));
    }
    if (countEl) {
      countEl.textContent = formatPagedCount({
        visible: pageItems.length,
        total: totalItems,
        page,
        pageSize
      });
    }
    if (emptyEl) emptyEl.toggleAttribute("hidden", totalItems > 0);
    if (clearBtn) clearBtn.toggleAttribute("hidden", !hasActiveFilters());
  };

  const apply = ({ resetPage = false } = {}) => {
    matchedItems = collectMatches();

    if (!paginator) {
      paginator = initPagination({
        navId: `${filterId}-pagination`,
        pageSize,
        getItems: () => matchedItems,
        getPage: () => {
          const p = new URLSearchParams(window.location.search);
          const raw = Number.parseInt(p.get("page") || "1", 10);
          return Number.isFinite(raw) && raw > 0 ? raw : 1;
        },
        setPageInUrl: (page) => writeUrl(page),
        onPageChange: (state) => showPage(state),
        onNavigate: () => {
          const grid = document.getElementById(`${filterId}-grid`);
          grid?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start"
          });
        }
      });
    }

    if (resetPage) {
      paginator.reset(buildUrlParams());
    } else {
      const state = paginator.refresh(buildUrlParams());
      writeUrl(state.page);
    }
  };

  const nodes = [searchInput, clearBtn, ...filters.map((f) => document.getElementById(f.id)), ...toggles.map((t) => document.getElementById(t.id))];
  for (const node of nodes) {
    node?.addEventListener("input", () => apply({ resetPage: true }));
    node?.addEventListener("change", () => apply({ resetPage: true }));
  }
  clearBtn?.addEventListener("click", clearAll);

  readUrl();
  apply();
}
