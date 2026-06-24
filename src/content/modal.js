import { renderMarkdown, renderRaw } from "./render.js";
import { fetchAttachment } from "./fetch.js";
import { resolveTheme } from "./theme.js";
import { debug } from "./debug.js";

let hostEl = null;
let shadow = null;
let savedFocus = null;
let currentUnload = null;

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

const MODAL_CSS = `
:host {
  all: initial;
}
dialog.overlay {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  max-width: none;
  max-height: none;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /* Responsive padding so the modal never touches screen edges.
     Larger on desktop, smaller on mobile. */
  padding: clamp(16px, 4vh, 48px) clamp(16px, 4vw, 48px);
}
dialog.overlay::backdrop {
  background: rgba(0,0,0,0.55);
}
.modal {
  width: min(880px, 100%);
  height: min(85vh, 720px);
  background: var(--gcmp-bg, #fff);
  color: var(--gcmp-fg, #1f1f1f);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  display: flex; flex-direction: column;
  overflow: hidden;
  margin: 0;
}
.modal[data-theme="dark"] {
  --gcmp-bg: #1e1e1e;
  --gcmp-fg: #e8eaed;
  --gcmp-border: #3c4043;
  --gcmp-muted: #9aa0a6;
  --gcmp-btn-bg: #2d2d2d;
  --gcmp-btn-fg: #e8eaed;
  --gcmp-code-bg: #2b2b2b;
  --gcmp-lineno: #6a6a6a;
}
.modal[data-theme="light"] {
  --gcmp-bg: #ffffff;
  --gcmp-fg: #1f1f1f;
  --gcmp-border: #dadce0;
  --gcmp-muted: #5f6368;
  --gcmp-btn-bg: #f1f3f4;
  --gcmp-btn-fg: #1f1f1f;
  --gcmp-code-bg: #f8f9fa;
  --gcmp-lineno: #bdc1c6;
}
.header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gcmp-border);
  flex: 0 0 auto;
}
.filename {
  font-size: 14px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1 1 auto;
}
.spacer { flex: 1 1 auto; }
.btn {
  background: var(--gcmp-btn-bg);
  color: var(--gcmp-btn-fg);
  border: 1px solid var(--gcmp-border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  flex: 0 0 auto;
}
.btn:hover { filter: brightness(1.08); }
.btn[aria-pressed="true"] { outline: 2px solid #8ab4f8; }
.icon-btn { padding: 6px; }
.body { flex: 1 1 auto; overflow: auto; padding: 20px 24px; }
.body.rendered { line-height: 1.6; font-size: 14px; }
.body.rendered h1, .body.rendered h2, .body.rendered h3 { margin: 1em 0 0.5em; }
.body.rendered h1 { font-size: 1.8em; border-bottom: 1px solid var(--gcmp-border); padding-bottom: .3em; }
.body.rendered h2 { font-size: 1.5em; border-bottom: 1px solid var(--gcmp-border); padding-bottom: .3em; }
.body.rendered h3 { font-size: 1.25em; }
.body.rendered p { margin: 0.6em 0; }
.body.rendered a { color: #8ab4f8; }
.body.rendered ul, .body.rendered ol { padding-left: 1.5em; }
.body.rendered blockquote {
  border-left: 3px solid var(--gcmp-border);
  padding-left: 1em; color: var(--gcmp-muted); margin: 0.6em 0;
}
.body.rendered pre {
  background: var(--gcmp-code-bg);
  padding: 12px; border-radius: 6px; overflow-x: auto;
  font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 13px;
}
.body.rendered code { font-family: 'Roboto Mono', ui-monospace, monospace; }
.body.rendered :not(pre) > code { background: var(--gcmp-code-bg); padding: 2px 4px; border-radius: 4px; }
.body.rendered table { border-collapse: collapse; }
.body.rendered th, .body.rendered td { border: 1px solid var(--gcmp-border); padding: 6px 10px; }
.body.rendered img { max-width: 100%; }
.body.raw { padding: 0; }
.raw-view { width: 100%; border-collapse: collapse; font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 13px; }
.raw-view .lineno { color: var(--gcmp-lineno); text-align: right; padding: 0 12px; user-select: none; width: 1%; white-space: pre; border-right: 1px solid var(--gcmp-border); }
.raw-view .code { padding: 0 12px; white-space: pre-wrap; word-break: break-word; }
.footer {
  padding: 8px 16px; border-top: 1px solid var(--gcmp-border);
  color: var(--gcmp-muted); font-size: 12px; flex: 0 0 auto;
  display: flex; align-items: center; gap: 12px;
}
.loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; height: 100%; color: var(--gcmp-muted);
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--gcmp-border);
  border-top-color: var(--gcmp-accent, #8ab4f8);
  border-radius: 50%;
  animation: gcmp-spin 0.8s linear infinite;
}
.loading-text { font-size: 13px; }
@keyframes gcmp-spin { to { transform: rotate(360deg); } }
.modal[data-theme="dark"] { --gcmp-accent: #8ab4f8; }
.modal[data-theme="light"] { --gcmp-accent: #1a73e8; }
.error { color: #f28b82; padding: 24px; }
.toast { padding: 4px 8px; background: var(--gcmp-btn-bg); border-radius: 4px; }
`;

function ensureHost() {
  if (hostEl && hostEl.isConnected) return;
  hostEl = document.createElement("div");
  hostEl.id = "gcmp-host";
  hostEl.style.cssText = "all: initial; position: static;";
  document.documentElement.appendChild(hostEl);
  shadow = hostEl.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = MODAL_CSS;
  shadow.appendChild(style);
}

// <dialog>::backdrop handles scroll-locking; no manual lock needed.

function trapKeydown(e) {
  // <dialog> with showModal() already traps focus and handles Esc.
  // We only intercept Esc to call closeModal() for our cleanup.
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  }
}

/**
 * Open the preview modal for a given attachment.
 * @param {{filename: string, url: string}} target
 * @param {{defaultView?: string, autoLanguage?: boolean, maxBytes?: number, copyButton?: boolean, theme?: string}} settings
 */
export async function openModal(target, settings = {}) {
  ensureHost();
  // If already open, close first.
  const existing = shadow.querySelector("dialog.overlay");
  if (existing) {
    closeModal();
  }
  savedFocus = document.activeElement;

  const theme = resolveTheme(settings.theme);
  const overlay = document.createElement("dialog");
  overlay.className = "overlay";
  overlay.setAttribute("aria-label", target.filename);
  overlay.innerHTML = `
    <div class="modal" data-theme="${theme}" role="document">
      <div class="header">
        <span class="filename" title="${escapeAttr(target.filename)}">${escapeHtml(target.filename)}</span>
        <span class="spacer"></span>
        <button class="btn" data-view="rendered" aria-pressed="${settings.defaultView === "rendered"}">Rendered</button>
        <button class="btn" data-view="raw" aria-pressed="${settings.defaultView === "raw"}">Raw</button>
        ${settings.copyButton !== false ? `<button class="btn icon-btn" data-action="copy" title="Copy to clipboard">${ICON_COPY}</button>` : ""}
        <a class="btn icon-btn" data-action="download" href="${escapeAttr(target.url)}" download="${escapeAttr(target.filename)}" target="_blank" rel="noopener" title="Download">${ICON_DOWNLOAD}</a>
        <button class="btn icon-btn" data-action="close" title="Close (Esc)">${ICON_CLOSE}</button>
      </div>
      <div class="body ${settings.defaultView === "raw" ? "raw" : "rendered"}">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading ${escapeHtml(target.filename)}…</div></div>
      </div>
      <div class="footer"><span class="status"></span></div>
    </div>`;
  shadow.appendChild(overlay);

  // showModal() places this dialog in the browser top layer — above ALL
  // page content regardless of z-index, transforms, or stacking contexts.
  // This is what beats Google Chat's expanded/fullscreen views.
  overlay.showModal();

  // Close when clicking the backdrop (the <dialog> itself, not .modal).
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action], [data-view]");
    if (!btn) return;
    if (btn.dataset.action === "close") closeModal();
    else if (btn.dataset.action === "copy") copyCurrent();
    else if (btn.dataset.view) switchView(btn.dataset.view);
  });

  // Intercept Esc at capture phase so our closeModal runs before the
  // browser's default dialog-close (which would skip our cleanup).
  document.addEventListener("keydown", trapKeydown, true);
  currentUnload = () => {
    document.removeEventListener("keydown", trapKeydown, true);
  };

  const body = overlay.querySelector(".body");
  const status = overlay.querySelector(".status");
  let rawText = null;
  let currentView = settings.defaultView || "rendered";

  try {
    debug.log("fetching attachment:", target.url);
    const result = await fetchAttachment(target.url, settings.maxBytes ?? 500_000);
    debug.log("fetch ok, length:", result.text?.length, "truncated:", result.truncated, "ct:", result.contentType);
    rawText = result.text;
    if (result.truncated) {
      status.textContent = `Truncated at ${formatBytes(settings.maxBytes)} — file is larger. Download for full content.`;
    }
    render(currentView);
  } catch (err) {
    debug.error("fetch failed:", err);
    body.className = "body";
    body.innerHTML = `<div class="error">⚠ ${escapeHtml(err.message || String(err))}</div>`;
  }

  function render(view) {
    if (!rawText) return;
    if (view === "raw") {
      body.className = "body raw";
      body.innerHTML = renderRaw(rawText);
    } else {
      body.className = "body rendered";
      body.innerHTML = renderMarkdown(rawText, {
        autoLanguage: settings.autoLanguage,
      });
    }
  }

  function switchView(view) {
    currentView = view;
    overlay.querySelectorAll('[data-view]').forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.view === view));
    });
    body.classList.toggle("raw", view === "raw");
    body.classList.toggle("rendered", view === "rendered");
    render(view);
  }

  function copyCurrent() {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText).then(() => {
      const t = document.createElement("span");
      t.className = "toast";
      t.textContent = "Copied ✓";
      status.appendChild(t);
      setTimeout(() => t.remove(), 1500);
    });
  }

  // focus first toggle for a11y
  const firstBtn = overlay.querySelector('[data-view]');
  if (firstBtn) firstBtn.focus();
}

export function closeModal() {
  if (!shadow) return;
  const overlay = shadow.querySelector("dialog.overlay");
  if (overlay) {
    if (overlay.open) overlay.close(); // removes from top layer
    overlay.remove();
  }
  if (currentUnload) {
    currentUnload();
    currentUnload = null;
  }
  if (savedFocus && savedFocus.focus) savedFocus.focus();
  savedFocus = null;
}

/**
 * Re-theme an already-open modal (called on settings change).
 */
export function applyTheme(theme) {
  if (!shadow) return;
  const modal = shadow.querySelector(".modal");
  if (!modal) return;
  modal.setAttribute("data-theme", resolveTheme(theme));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}