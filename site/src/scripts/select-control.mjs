const initialized = new WeakSet();

export function initSelectControls(root = document) {
  for (const el of root.querySelectorAll("[data-select-root]")) {
    if (initialized.has(el)) continue;
    initialized.add(el);
    wireSelect(el);
  }
}

function wireSelect(root) {
  const trigger = root.querySelector(".select-trigger");
  const listbox = root.querySelector(".select-listbox");
  const native = root.querySelector(".select-native");
  const valueEl = root.querySelector("[data-select-value]");
  if (!trigger || !listbox || !native || !valueEl) return;

  const options = [...listbox.querySelectorAll(".select-option")];
  let activeIndex = options.findIndex((o) => o.getAttribute("aria-selected") === "true");
  if (activeIndex < 0) activeIndex = 0;

  const close = () => {
    listbox.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    listbox.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const selected = options.find((o) => o.getAttribute("aria-selected") === "true");
    if (selected) selected.scrollIntoView({ block: "nearest" });
    listbox.focus();
  };

  const selectOption = (option) => {
    const value = option.dataset.value ?? "";
    native.value = value;
    valueEl.textContent = option.textContent?.trim() ?? "";
    for (const o of options) {
      o.setAttribute("aria-selected", o === option ? "true" : "false");
    }
    activeIndex = options.indexOf(option);
    close();
    native.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const syncFromNative = () => {
    const selected = options.find((option) => (option.dataset.value ?? "") === native.value) || options[0];
    if (!selected) return;
    valueEl.textContent = selected.textContent?.trim() ?? "";
    for (const option of options) {
      option.setAttribute("aria-selected", option === selected ? "true" : "false");
    }
    activeIndex = options.indexOf(selected);
  };

  native.addEventListener("change", syncFromNative);
  queueMicrotask(syncFromNative);

  trigger.addEventListener("click", () => {
    if (listbox.hidden) open();
    else close();
  });

  listbox.addEventListener("click", (e) => {
    const option = e.target.closest(".select-option");
    if (option) selectOption(option);
  });

  listbox.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      trigger.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      options[activeIndex]?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      options[activeIndex]?.focus();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const focused = document.activeElement?.closest?.(".select-option");
      if (focused) selectOption(focused);
    }
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) close();
  });
}

if (typeof document !== "undefined") {
  initSelectControls();
  document.addEventListener("astro:page-load", () => initSelectControls());
}
