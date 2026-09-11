import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  { stdio: "inherit" },
);
execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
  stdio: "inherit",
});
await build({
  entryPoints: ["server/worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/server/index.js",
});
await mkdir("dist/.openai", { recursive: true });
const manifest = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
await writeFile("dist/.openai/hosting.json", JSON.stringify(manifest, null, 2));
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
