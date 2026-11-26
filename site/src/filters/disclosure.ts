/**
 * The filter bar's panel. It opens over the page instead of pushing it down, so
 * opening and closing never move the charts. It closes on Escape, and when the
 * pointer or keyboard focus goes elsewhere, so it can't hide what has focus.
 */
export function disclosure(
  section: HTMLElement,
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  onChange: (open: boolean) => void,
): void {
  function outside(event: Event): void {
    // A tab change can remove the whole section while the panel is open.
    if (!section.isConnected || !section.contains(event.target as Node)) set(false);
  }

  function set(open: boolean): void {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    onChange(open);
    for (const type of ["pointerdown", "focusin"]) {
      if (open) document.addEventListener(type, outside, true);
      else document.removeEventListener(type, outside, true);
    }
  }

  toggle.addEventListener("click", () => set(Boolean(panel.hidden)));
  section.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden || event.defaultPrevented) return;
    event.preventDefault();
    set(false);
    toggle.focus();
  });
  set(false);
}

/**
 * Tells the stylesheet how tall the bar is, so that scrolling to a focused
 * element leaves it below the bar instead of behind it.
 */
export function reserveSpace(bar: HTMLElement): void {
  new ResizeObserver(() => {
    // A removed bar measures 0. The next tab's bar sets its own height.
    if (bar.isConnected) {
      document.documentElement.style.setProperty("--filter-bar-height", `${bar.offsetHeight}px`);
    }
  }).observe(bar);
}
