const KEY = "settings";

function getStorage() {
  return (typeof chrome !== "undefined" ? chrome : browser).storage.sync;
}

function load() {
  return new Promise((resolve) => {
    getStorage().get(KEY, (res) => resolve(res[KEY] || {}));
  });
}

function save(patch) {
  return new Promise((resolve) => {
    getStorage().get(KEY, (res) => {
      const next = { ...(res[KEY] || {}), ...patch };
      getStorage().set({ [KEY]: next }, () => resolve(next));
    });
  });
}

const els = {
  enabled: document.getElementById("enabled"),
  theme: document.getElementById("theme"),
  defaultView: document.getElementById("defaultView"),
  showEyeButton: document.getElementById("showEyeButton"),
  openOptions: document.getElementById("openOptions"),
  version: document.getElementById("version"),
};

async function init() {
  const cfg = await load();
  els.enabled.checked = cfg.enabled !== false;
  els.theme.value = cfg.theme || "auto";
  els.defaultView.value = cfg.defaultView || "rendered";
  els.showEyeButton.checked = cfg.showEyeButton !== false;

  els.enabled.addEventListener("change", () =>
    save({ enabled: els.enabled.checked }),
  );
  els.theme.addEventListener("change", () =>
    save({ theme: els.theme.value }),
  );
  els.defaultView.addEventListener("change", () =>
    save({ defaultView: els.defaultView.value }),
  );
  els.showEyeButton.addEventListener("change", () =>
    save({ showEyeButton: els.showEyeButton.checked }),
  );

  els.openOptions.addEventListener("click", () => {
    const api = typeof chrome !== "undefined" ? chrome : browser;
    api.runtime.openOptionsPage();
    window.close();
  });

  const api = typeof chrome !== "undefined" ? chrome : browser;
  const manifest = api.runtime.getManifest();
  if (els.version) els.version.textContent = `v${manifest.version}`;
}

init();