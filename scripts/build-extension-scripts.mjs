import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const buildOptions = {
  entryPoints: {
    "background/service-worker": "src/background/service-worker.ts",
    "content/sleeper-draft-page": "src/content/sleeper-draft-page.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const buildContext = await context(buildOptions);
  await buildContext.watch();
  console.log("Watching extension service worker and content script...");
} else {
  await build(buildOptions);
}
