/**
 * Client-side pagination with URL sync.
 */

function readPage(params, pageParam) {
  const raw = params.get(pageParam);
  const page = Number.parseInt(raw || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

function renderNav(navEl, { current, total, onPage }) {
  if (!navEl) return;
  if (total <= 1) {
    navEl.hidden = true;
    navEl.innerHTML = "";
    return;
  }

  navEl.hidden = false;
  const pages = pageNumbers(current, total);
  const pageButtons = pages
    .map((p) =>
      p === "…"
        ? `<span class="pagination-ellipsis" aria-hidden="true">…</span>`
        : `<button type="button" class="pagination-btn" data-page="${p}" aria-label="Page ${p}"${p === current ? ' aria-current="page"' : ""}>${p}</button>`
    )
    .join("");

  navEl.innerHTML = `
    <button type="button" class="pagination-btn pagination-prev" data-page="prev" aria-label="Previous page"${current <= 1 ? " disabled" : ""}>Prev</button>
    <div class="pagination-pages" role="group" aria-label="Page numbers">${pageButtons}</div>
    <button type="button" class="pagination-btn pagination-next" data-page="next" aria-label="Next page"${current >= total ? " disabled" : ""}>Next</button>
    <span class="pagination-summary">Page ${current} of ${total}</span>
  `;

  navEl.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const action = btn.getAttribute("data-page");
      if (action === "prev") onPage(current - 1);
      else if (action === "next") onPage(current + 1);
      else onPage(Number.parseInt(action, 10));
    });
  });
}

/**
 * Generic paginator for externally managed item lists.
 */
export function initPagination({
  navId,
  pageSize = 24,
  pageParam = "page",
  getPage = () => readPage(new URLSearchParams(window.location.search), pageParam),
  setPageInUrl = (page, extraParams) => {
    const next = new URLSearchParams(extraParams || window.location.search);
    if (page <= 1) next.delete(pageParam);
    else next.set(pageParam, String(page));
    const qs = next.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  },
  getItems,
  onPageChange,
  onNavigate
}) {
  const navEl = document.getElementById(navId);
  let currentPage = getPage();

  const goToPage = (page, { writeUrl = true, extraParams } = {}) => {
    const items = getItems();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const nextPage = Math.min(Math.max(1, page), totalPages);
    currentPage = nextPage;
    const start = (nextPage - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    if (writeUrl) setPageInUrl(nextPage, extraParams);
    renderNav(navEl, {
      current: nextPage,
      total: totalPages,
      onPage: (p) => {
        const state = goToPage(p);
        onNavigate?.(state);
      }
    });
    onPageChange?.({ page: nextPage, totalPages, items: slice, totalItems: items.length });
    return { page: nextPage, totalPages, items: slice, totalItems: items.length };
  };

  const reset = (extraParams) => goToPage(1, { writeUrl: true, extraParams });

  return {
    refresh(extraParams) {
      const items = getItems();
      const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      return goToPage(currentPage, { writeUrl: false, extraParams });
    },
    reset,
    get page() {
      return currentPage;
    }
  };
}

/**
 * Paginate a static grid by toggling [hidden] on child items.
 */
export function initGridPagination({
  gridId,
  itemSelector,
  navId,
  pageSize = 24,
  pageParam = "page"
}) {
  const grid = document.getElementById(gridId);
  if (!grid) return null;

  const getItems = () => [...grid.querySelectorAll(itemSelector)];

  const paginator = initPagination({
    navId,
    pageSize,
    pageParam,
    getItems,
    onPageChange({ items }) {
      const visible = new Set(items);
      for (const item of getItems()) {
        item.toggleAttribute("hidden", !visible.has(item));
      }
    }
  });

  paginator.refresh();
  return paginator;
}

/**
 * Format explorer result count with pagination info.
 */
export function formatPagedCount({ visible, total, page, pageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const range = total === 0 ? "0 results" : `${start}–${end} of ${total} result${total === 1 ? "" : "s"}`;
  if (totalPages <= 1) return range;
  return `${range} · page ${page} of ${totalPages}`;
}
