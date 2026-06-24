// Background fetch relay: bypasses CORS for cross-origin attachment hosts.
// Content script sends {type:'fetch-attachment', url, maxBytes}; we fetch with
// credentials:'include' (host_permissions grants same-origin privileges) and
// return {text, truncated, contentType} or {error}.

const PREFIX = "[gc-md-preview:bg]";
const log = (...a) => console.log(PREFIX, ...a);
const error = (...a) => console.error(PREFIX, ...a);

async function handleFetchAttachment({ url, maxBytes = 500_000 }) {
  log("fetching", url, "maxBytes:", maxBytes);
  const resp = await fetch(url, { credentials: "include" });
  log("response:", resp.status, resp.statusText, "ct:", resp.headers.get("content-type"));
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const txt = await resp.text();
    if (/<\/html>/i.test(txt)) {
      throw new Error(
        "Google returned an HTML page instead of the file. You may need to re-authenticate in this tab.",
      );
    }
    return { text: txt, truncated: false, contentType: ct };
  }
  const reader = resp.body?.getReader();
  if (!reader) {
    const text = await resp.text();
    return truncate(text, maxBytes, ct);
  }
  let received = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    chunks.push(value);
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* reader already closed */
      }
      return {
        text: decodeChunks(chunks, maxBytes),
        truncated: true,
        contentType: ct,
      };
    }
  }
  return {
    text: decodeChunks(chunks),
    truncated: false,
    contentType: ct,
  };
}

function truncate(text, maxBytes, ct) {
  if (text.length <= maxBytes) {
    return { text, truncated: false, contentType: ct };
  }
  return { text: text.slice(0, maxBytes), truncated: true, contentType: ct };
}

function decodeChunks(chunks, limit) {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder.decode(out).slice(0, limit ?? undefined);
}

const api = typeof chrome !== "undefined" ? chrome : browser;

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "fetch-attachment") return false;
  log("received fetch request for", msg.url);
  handleFetchAttachment(msg)
    .then((result) => {
      log("fetch complete, text length:", result.text?.length, "truncated:", result.truncated);
      sendResponse({ ok: true, result });
    })
    .catch((err) => {
      error("fetch failed:", err?.message || err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    });
  return true; // async response
});