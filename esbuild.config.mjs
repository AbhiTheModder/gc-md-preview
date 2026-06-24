import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");
const minify = !isWatch;

const shared = {
  bundle: true,
  target: "es2020",
  format: "iife",
  sourcemap: isWatch ? "inline" : false,
  minify,
  logLevel: "info",
};

const entryPoints = [
  { in: "src/content/index.js", out: "content" },
  { in: "src/popup/popup.js", out: "popup/popup" },
  { in: "src/options/options.js", out: "options/options" },
];

function buildFor(browser) {
  return Promise.all(
    entryPoints.map((e) =>
      esbuild.build({
        ...shared,
        entryPoints: [e.in],
        outfile: `dist/${browser}/${e.out}.js`,
        define: {
          "process.env.BROWSER": JSON.stringify(browser),
          "process.env.NODE_ENV": JSON.stringify(
            isWatch ? "development" : "production",
          ),
        },
      }),
    ),
  );
}

async function main() {
  await Promise.all([buildFor("chrome"), buildFor("firefox")]);
  if (isWatch) {
    const ctxChrome = await esbuild.context({
      ...shared,
      entryPoints,
      outbase: "src",
      outdir: "dist/chrome",
      define: { "process.env.BROWSER": '"chrome"' },
    });
    const ctxFx = await esbuild.context({
      ...shared,
      entryPoints,
      outbase: "src",
      outdir: "dist/firefox",
      define: { "process.env.BROWSER": '"firefox"' },
    });
    await Promise.all([ctxChrome.watch(), ctxFx.watch()]);
    console.log("[watch] building chrome + firefox...");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});