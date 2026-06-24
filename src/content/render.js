import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  configured = true;
}

/**
 * Render markdown -> sanitized HTML with syntax highlighting.
 * @param {string} md
 * @param {{autoLanguage?: boolean}} opts
 * @returns {string}
 */
export function renderMarkdown(md, opts = {}) {
  ensureConfigured();
  const raw = marked.parse(md, { async: false });
  // Post-process: highlight <pre><code> blocks
  const tmp = document.createElement("div");
  tmp.innerHTML = raw;
  tmp.querySelectorAll("pre code").forEach((block) => {
    try {
      if (opts.autoLanguage !== false) {
        const result = hljs.highlightAuto(block.textContent);
        block.innerHTML = result.value;
      } else {
        const cls = block.className.match(/language-(\w+)/);
        const lang = cls ? cls[1] : null;
        if (lang && hljs.getLanguage(lang)) {
          block.innerHTML = hljs.highlight(block.textContent, { language: lang }).value;
        }
      }
      block.classList.add("hljs");
    } catch {
      /* leave as-is */
    }
  });
  const dirty = tmp.innerHTML;
  return DOMPurify.sanitize(dirty, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Render raw markdown with line numbers.
 */
export function renderRaw(md) {
  const escaped = escapeHtml(md);
  const lines = escaped.split("\n");
  const cells = lines
    .map(
      (line, i) =>
        `<tr><td class="lineno">${i + 1}</td><td class="code">${
          line || "&nbsp;"
        }</td></tr>`,
    )
    .join("");
  return `<table class="raw-view">${cells}</table>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}