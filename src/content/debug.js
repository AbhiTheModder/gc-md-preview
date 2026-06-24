const PREFIX = "[gc-md-preview]";
let enabled = false;

export function setDebugEnabled(v) {
  enabled = !!v;
}

function log(level, ...args) {
  if (!enabled) return;
  try {
    console[level](PREFIX, ...args);
  } catch {
    /* console unavailable */
  }
}

export const debug = {
  log: (...a) => log("log", ...a),
  info: (...a) => log("info", ...a),
  warn: (...a) => log("warn", ...a),
  error: (...a) => log("error", ...a),
  group: (...a) => log("groupCollapsed", ...a),
  groupEnd: () => log("groupEnd"),
};