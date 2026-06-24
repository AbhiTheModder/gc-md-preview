export const DEFAULTS = Object.freeze({
  enabled: true,
  theme: "auto",
  defaultView: "rendered",
  autoLanguage: true,
  maxBytes: 500_000,
  copyButton: true,
  showEyeButton: true,
  extensions: ["md", "markdown", "mdown", "mkd"],
  debugLogging: false,
});

const STORAGE_KEY = "settings";

function getApi() {
  if (typeof chrome !== "undefined" && chrome.storage) return chrome.storage.sync;
  if (typeof browser !== "undefined" && browser.storage) {
    return browser.storage.sync;
  }
  return null;
}

export async function loadConfig() {
  const store = getApi();
  if (!store) return { ...DEFAULTS };
  return new Promise((resolve) => {
    store.get(STORAGE_KEY, (res) => {
      resolve({ ...DEFAULTS, ...(res[STORAGE_KEY] || {}) });
    });
  });
}

export function onChanged(listener) {
  const api = typeof chrome !== "undefined" ? chrome : browser;
  if (!api?.storage?.onChanged) return;
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY]) {
      listener({ ...DEFAULTS, ...changes[STORAGE_KEY].newValue });
    }
  });
}