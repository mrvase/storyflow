export const isCMSElement = (el: HTMLElement | null) => {
  return el && "dataset" in el && typeof el.dataset.parent === "string";
};

export const isActiveSibling = (activeEl: HTMLElement, path: string[]) => {
  if (isCMSElement(activeEl)) {
    const thisParent = path.slice(0, -1).join(".");
    return activeEl.dataset.parent === thisParent;
  }
  return false;
};

export const isActiveEl = (activeEl: HTMLElement, path: string[]) => {
  if (isActiveSibling(activeEl, path)) {
    const thisId = path.slice(-1)[0];
    return activeEl.dataset.element === thisId;
  }
  return false;
};

export const focusCMSElement = (path: string[]) => {
  const thisParent = path.slice(0, -1).join(".");
  const thisId = path.slice(-1)[0];
  const el = document.querySelector(
    `[data-parent="${thisParent}"][data-element="${thisId}"]`
  ) as HTMLElement | null;
  requestAnimationFrame(() => el?.focus?.());
};

export const getSiblings = (pathOrEl: string[] | HTMLElement | null) => {
  if (!pathOrEl) return [];
  const parent = Array.isArray(pathOrEl)
    ? pathOrEl.slice(0, -1).join(".")
    : pathOrEl.dataset.parent;
  return Array.from(
    document.querySelectorAll(`[data-parent="${parent}"]`)
  ) as HTMLElement[];
};
