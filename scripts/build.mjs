import { build } from "esbuild";
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const isWatch = process.argv.includes("--watch");

const entryPoints = [
  { in: join(root, "src/content/index.js"), out: "content" },
  { in: join(root, "src/popup/popup.js"), out: "popup/popup" },
  { in: join(root, "src/options/options.js"), out: "options/options" },
  { in: join(root, "src/background/sw.js"), out: "background" },
];

const sharedConfig = {
  bundle: true,
  target: "es2020",
  format: "iife",
  sourcemap: isWatch ? "inline" : false,
  minify: !isWatch,
  logLevel: "info",
};

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function copyStatic(browser) {
  const staticFiles = [
    { from: "src/popup/popup.html", to: "popup/popup.html" },
    { from: "src/popup/popup.css", to: "popup/popup.css" },
    { from: "src/options/options.html", to: "options/options.html" },
    { from: "src/options/options.css", to: "options/options.css" },
  ];
  for (const f of staticFiles) {
    const src = join(root, f.from);
    if (existsSync(src)) {
      const dest = join(root, `dist/${browser}`, f.to);
      ensureDir(dirname(dest));
      copyFileSync(src, dest);
    }
  }
  // icons
  const iconsDir = join(root, "icons");
  if (existsSync(iconsDir)) {
    const dest = join(root, `dist/${browser}/icons`);
    ensureDir(dest);
    for (const f of readdirSync(iconsDir)) {
      copyFileSync(join(iconsDir, f), join(dest, f));
    }
  }
  // manifest
  const manifestSrc = join(root, `manifest.${browser}.json`);
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, join(root, `dist/${browser}/manifest.json`));
  }
}

async function buildBrowser(browser) {
  const outdir = join(root, `dist/${browser}`);
  ensureDir(outdir);
  const results = await Promise.all(
    entryPoints.map((e) =>
      build({
        ...sharedConfig,
        entryPoints: [e.in],
        outfile: join(outdir, `${e.out}.js`),
        define: {
          "process.env.BROWSER": JSON.stringify(browser),
          "process.env.NODE_ENV": JSON.stringify(isWatch ? "development" : "production"),
        },
      }),
    ),
  );
  copyStatic(browser);
  return results;
}

async function main() {
  if (!isWatch) {
    rmSync(join(root, "dist"), { recursive: true, force: true });
  }
  await Promise.all([buildBrowser("chrome"), buildBrowser("firefox")]);
  console.log("✓ build complete → dist/chrome, dist/firefox");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});