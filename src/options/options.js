const KEY = "settings";
const DEFAULTS = {
  enabled: true,
  theme: "auto",
  defaultView: "rendered",
  autoLanguage: true,
  maxBytes: 500_000,
  copyButton: true,
  showEyeButton: true,
  extensions: ["md", "markdown", "mdown", "mkd"],
  debugLogging: false,
};

function getStorage() {
  return (typeof chrome !== "undefined" ? chrome : browser).storage.sync;
}

function load() {
  return new Promise((resolve) => {
    getStorage().get(KEY, (res) => resolve({ ...DEFAULTS, ...(res[KEY] || {}) }));
  });
}

function saveAll(cfg) {
  return new Promise((resolve) => {
    getStorage().set({ [KEY]: cfg }, () => resolve());
  });
}

const els = {
  enabled: document.getElementById("enabled"),
  showEyeButton: document.getElementById("showEyeButton"),
  theme: document.getElementById("theme"),
  defaultView: document.getElementById("defaultView"),
  autoLanguage: document.getElementById("autoLanguage"),
  copyButton: document.getElementById("copyButton"),
  maxBytes: document.getElementById("maxBytes"),
  debugLogging: document.getElementById("debugLogging"),
  extensions: document.getElementById("extensions"),
  extError: document.getElementById("extError"),
  save: document.getElementById("save"),
  saved: document.getElementById("saved"),
  version: document.getElementById("version"),
};

function parseExtensions(raw) {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}

function validateExtensions(exts) {
  if (exts.length === 0) return "At least one extension is required.";
  for (const e of exts) {
    if (!/^[a-z0-9]{1,10}$/.test(e)) {
      return `Invalid extension "${e}". Use letters/digits only, max 10 chars.`;
    }
  }
  return null;
}

async function init() {
  const cfg = await load();
  els.enabled.checked = cfg.enabled;
  els.showEyeButton.checked = cfg.showEyeButton;
  els.theme.value = cfg.theme;
  els.defaultView.value = cfg.defaultView;
  els.autoLanguage.checked = cfg.autoLanguage;
  els.copyButton.checked = cfg.copyButton;
  els.maxBytes.value = String(Math.round(cfg.maxBytes / 1024));
  els.debugLogging.checked = cfg.debugLogging;
  els.extensions.value = cfg.extensions.join(", ");

  els.save.addEventListener("click", async () => {
    const exts = parseExtensions(els.extensions.value);
    const err = validateExtensions(exts);
    if (err) {
      els.extError.textContent = err;
      return;
    }
    els.extError.textContent = "";
    const next = {
      enabled: els.enabled.checked,
      showEyeButton: els.showEyeButton.checked,
      theme: els.theme.value,
      defaultView: els.defaultView.value,
      autoLanguage: els.autoLanguage.checked,
      copyButton: els.copyButton.checked,
      maxBytes: Math.max(1, parseInt(els.maxBytes.value, 10) || 500) * 1024,
      debugLogging: els.debugLogging.checked,
      extensions: exts,
    };
    await saveAll(next);
    els.saved.hidden = false;
    setTimeout(() => (els.saved.hidden = true), 2000);
  });

  const api = typeof chrome !== "undefined" ? chrome : browser;
  const manifest = api.runtime.getManifest();
  els.version.textContent = manifest.version;
}

init();