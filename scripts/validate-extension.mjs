import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const manifestPath = resolve(distDirectory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.manifest_version !== 3) {
  throw new Error("Expected a Manifest V3 extension");
}

const requiredFiles = [
  manifest.side_panel?.default_path,
  manifest.background?.service_worker,
  ...manifest.content_scripts.flatMap((entry) => entry.js ?? []),
].filter((path) => typeof path === "string");

if (requiredFiles.length < 3) {
  throw new Error("Manifest is missing a side panel, service worker, or content script");
}

await Promise.all(requiredFiles.map((path) => access(resolve(distDirectory, path))));

console.log(`Validated Manifest V3 build with ${requiredFiles.length} required entry files.`);
