import { loadConfig, onChanged, DEFAULTS } from "./config.js";
import { findMarkdownChips } from "./detect.js";
import { openModal, applyTheme } from "./modal.js";
import { watchSystemTheme } from "./theme.js";
import { debug, setDebugEnabled } from "./debug.js";

const PROCESSED = new WeakSet();
const PREVIEW_BTN_FLAG = "gcmpPreview";

const BTN_CSS = `
.gcmp-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:none;border-radius:50%;background:transparent;color:#5f6368;cursor:pointer;padding:0;margin:0 2px;vertical-align:middle;transition:background-color .15s}
.gcmp-btn:hover{background-color:rgba(60,64,67,.08)}
.gcmp-btn:focus-visible{outline:2px solid #8ab4f8;outline-offset:2px}
.gcmp-eye{fill:currentColor}
`;

let cfg = { ...DEFAULTS };
let scanTimer = null;
let observer = null;

function injectStyles() {
  if (document.getElementById("gcmp-styles")) return;
  const s = document.createElement("style");
  s.id = "gcmp-styles";
  s.textContent = BTN_CSS;
  document.head.appendChild(s);
}

const EYE_SVG =
  '<svg class="gcmp-eye" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>';

function injectPreviewButton({ chip, filename, url }) {
  if (PROCESSED.has(chip)) return;
  if (!url) {
    debug.warn("chip has no URL, skipping:", filename);
    PROCESSED.add(chip);
    return;
  }
  const existingBtn = chip.querySelector('button[aria-label="Open in new tab"]');
  const container = existingBtn
    ? existingBtn.closest("a") || existingBtn.parentElement
    : chip;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = existingBtn ? existingBtn.className : "gcmp-btn";
  btn.setAttribute("aria-label", "Preview markdown");
  btn.setAttribute("title", "Preview markdown");
  btn.setAttribute("data-gcmp", PREVIEW_BTN_FLAG);
  btn.style.cursor = "pointer";
  btn.innerHTML = EYE_SVG;

  // Use capture phase so we run before Google's own listeners on the chip,
  // and stopPropagation so the click doesn't trigger the file download.
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    debug.group("preview button clicked for", filename);
    debug.log("url:", url);
    debug.log("settings:", cfg);
    try {
      openModal({ filename, url }, cfg);
      debug.log("openModal returned (modal should be visible now)");
    } catch (err) {
      debug.error("openModal threw:", err);
    }
    debug.groupEnd();
  }, true);

  if (container && container.parentElement) {
    container.parentElement.insertBefore(btn, container.nextSibling);
    debug.log("injected preview button for:", filename, "(cloned styles:", !!existingBtn, ")");
  } else {
    chip.appendChild(btn);
    debug.log("injected preview button (fallback) for:", filename);
  }
  PROCESSED.add(chip);
}

function removeAllButtons() {
  document.querySelectorAll(`[data-gcmp="${PREVIEW_BTN_FLAG}"]`).forEach((b) => b.remove());
}

function scan() {
  if (!cfg.enabled || !cfg.showEyeButton) {
    debug.log("scan skipped (disabled or eye hidden)");
    return;
  }
  const chips = findMarkdownChips(document.body, cfg.extensions);
  debug.log("scan found", chips.length, "markdown chip(s)");
  let injected = 0;
  for (const c of chips) {
    const before = PROCESSED.has(c.chip);
    injectPreviewButton(c);
    if (!before) injected++;
  }
  if (injected > 0) debug.log("scan injected", injected, "new button(s)");
}

function debouncedScan() {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scan();
  }, 150);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(debouncedScan);
  observer.observe(document.body, { childList: true, subtree: true });
  debug.log("MutationObserver started");
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
    debug.log("MutationObserver stopped");
  }
}

function applyConfigChange(newCfg) {
  const prevEnabled = cfg.enabled;
  const prevEye = cfg.showEyeButton;
  const prevExts = cfg.extensions.join(",");
  cfg = newCfg;
  setDebugEnabled(cfg.debugLogging);
  debug.log("config changed:", cfg);
  if (!cfg.enabled || !cfg.showEyeButton) {
    removeAllButtons();
  }
  if (prevExts !== cfg.extensions.join(",")) {
    scan();
  }
  applyTheme(cfg.theme);
  if (cfg.enabled && cfg.showEyeButton && (!prevEnabled || !prevEye)) {
    scan();
  }
}

async function init() {
  debug.log("initializing content script @", location.href);
  injectStyles();
  cfg = await loadConfig();
  setDebugEnabled(cfg.debugLogging);
  debug.log("loaded config:", cfg);
  if (cfg.enabled && cfg.showEyeButton) {
    scan();
    startObserver();
  } else {
    debug.log("extension disabled or eye hidden, skipping initial scan");
  }
  onChanged((next) => {
    applyConfigChange(next);
    if (cfg.enabled && cfg.showEyeButton && !observer) startObserver();
    else if (!cfg.enabled || !cfg.showEyeButton) {
      if (observer) stopObserver();
    }
  });
  watchSystemTheme(() => applyTheme(cfg.theme));
  debug.log("content script ready");
}

init().catch((e) => console.error("[gc-md-preview] init failed", e));