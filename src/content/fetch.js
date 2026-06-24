import { debug } from "./debug.js";

/**
 * Relay attachment fetch through the background service worker.
 *
 * Google serves markdown attachments from chat.usercontent.google.com,
 * which does NOT send Access-Control-Allow-Origin. A content-script fetch
 * is bound by the page's CORS, so it fails. The extension background,
 * however, has host_permissions for that host and is treated as same-origin
 * (credentials still flow). So we message-pass the URL there.
 */

function getApi() {
  return typeof chrome !== "undefined" ? chrome : browser;
}

export async function fetchAttachment(url, maxBytes) {
  debug.log("fetchAttachment: sending message to background for", url);
  const api = getApi();
  const payload = { type: "fetch-attachment", url, maxBytes };
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage(payload, (resp) => {
      if (api.runtime.lastError) {
        debug.error("fetchAttachment: runtime error:", api.runtime.lastError.message);
        reject(new Error(api.runtime.lastError.message));
        return;
      }
      if (!resp) {
        debug.error("fetchAttachment: no response from background");
        reject(new Error("No response from background"));
        return;
      }
      if (!resp.ok) {
        debug.error("fetchAttachment: background error:", resp.error);
        reject(new Error(resp.error || "Unknown fetch error"));
        return;
      }
      debug.log("fetchAttachment: success, length:", resp.result?.text?.length);
      resolve(resp.result);
    });
  });
}