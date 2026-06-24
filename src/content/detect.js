/**
 * Multi-signal markdown chip detection for Google Chat.
 *
 * Google randomizes class names, so we anchor on stable signals:
 *  - [role="button"] with aria-label/title ending in .md / .markdown / ...
 *  - a child <span> whose background-image contains
 *    drive-thirdparty.googleusercontent.com ... type/text/markdown
 *  - a child <a href> with url_type=DOWNLOAD_URL
 *
 * We return null for elements that don't satisfy at least 2 of those signals
 * (filename + one other), to minimize false positives.
 */

const MARKDOWN_TYPE_URL = "drive-thirdparty.googleusercontent.com";
const DOWNLOAD_PARAM = "url_type=DOWNLOAD_URL";

function cleanFilename(filename) {
  if (!filename) return filename;
  return filename
    .replace(/^Text,\s*/i, "")
    .replace(/[\s.!?,;:]+$/g, "");
}

function extMatches(filename, exts) {
  if (!filename) return null;
  const lower = cleanFilename(filename).toLowerCase();
  for (const ext of exts) {
    const dot = `.${ext}`;
    if (lower.endsWith(dot)) return ext;
  }
  return null;
}

function filenameFromChip(chip) {
  const aria = chip.getAttribute("aria-label") || chip.getAttribute("title") || "";
  if (aria) return cleanFilename(aria.trim());
  const span = chip.querySelector("span");
  return span ? cleanFilename(span.textContent.trim()) : null;
}

function findMarkdownTypeSpan(chip) {
  const spans = chip.querySelectorAll("span[style]");
  for (const s of spans) {
    const style = s.getAttribute("style") || "";
    if (style.includes(MARKDOWN_TYPE_URL) && style.includes("text/markdown")) {
      return s;
    }
  }
  return null;
}

function findDownloadAnchor(chip) {
  const anchors = chip.querySelectorAll('a[href]');
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (href.includes(DOWNLOAD_PARAM)) return a;
  }
  return null;
}

/**
 * Resolve the raw attachment URL for previewing.
 * Prefer DOWNLOAD_URL; if only THUMBNAIL_URL exists, swap the param.
 */
function resolveAttachmentUrl(anchor) {
  if (!anchor) return null;
  const href = anchor.getAttribute("href");
  if (!href) return null;
  if (href.includes(DOWNLOAD_PARAM)) return href;
  // fall back: replace url_type=THUMBNAIL_URL -> DOWNLOAD_URL
  if (href.includes("url_type=THUMBNAIL_URL")) {
    return href.replace("url_type=THUMBNAIL_URL", DOWNLOAD_PARAM);
  }
  return href;
}

/**
 * Scan a root element for markdown chips and return descriptors.
 * @param {Element} root
 * @param {string[]} exts - extensions to match (lowercased, no dot)
 * @returns {Array<{chip: Element, filename: string, url: string}>}
 */
export function findMarkdownChips(root, exts) {
  const candidates = root.querySelectorAll(
    '[role="button"][aria-label], [role="button"][title]',
  );
  const out = [];
  for (const chip of candidates) {
    const filename = filenameFromChip(chip);
    const ext = extMatches(filename, exts);
    if (!ext) continue;

    const typeSpan = findMarkdownTypeSpan(chip);
    const anchor = findDownloadAnchor(chip);
    // filename match + at least one other signal
    if (!typeSpan && !anchor) continue;

    const url = resolveAttachmentUrl(anchor) || null;
    out.push({ chip, filename, url, ext });
  }
  return out;
}