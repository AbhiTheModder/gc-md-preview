/**
 * Resolve the effective theme for the preview modal.
 *
 * 'auto' reads Google Chat's own `data-theme` attribute on <body>,
 * which is set to "dark" or "light" by Chat itself.
 */

export function resolveTheme(stored) {
  if (stored !== "auto") return stored;
  const attr = document.body && document.body.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  // Fallback to OS preference if Chat's attribute is missing.
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function watchSystemTheme(cb) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => cb();
  if (mq.addEventListener) mq.addEventListener("change", handler);
  else mq.addListener(handler);
  // Watch Chat's own data-theme attribute on <body>.
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes" && m.attributeName === "data-theme") {
        cb();
        return;
      }
    }
  });
  if (document.body) {
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
  }
  return () => {
    if (mq.removeEventListener) mq.removeEventListener("change", handler);
    else mq.removeListener(handler);
    obs.disconnect();
  };
}