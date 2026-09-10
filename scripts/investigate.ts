import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { investigate, toMarkdown, LIMITS } from "../core/engine.ts";
const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log(
    'Usage: npm run investigate -- <logs.txt> [runbook.md] [--question "Why did it fail?"] [--json]\nNo network requests or API keys. Input is capped at 256 KB.',
  );
  process.exit(args.includes("--help") ? 0 : 1);
}
const questionIndex = args.indexOf("--question");
if (questionIndex !== -1 && !args[questionIndex + 1])
  throw new Error("--question requires a value");
const question =
  questionIndex === -1
    ? "What failed, and what should I check next?"
    : args[questionIndex + 1];
const files = args.filter(
  (a, i) =>
    a !== "--json" &&
    a !== "--question" &&
    (questionIndex === -1 || i !== questionIndex + 1),
);
// The CLI reads only explicitly named files, never recursively scans a workspace.
if (files.length > LIMITS.sources)
  throw new Error("At most 12 source files are supported.");
const sizes = await Promise.all(
  files.map(async (name) => (await stat(name)).size),
);
if (sizes.reduce((n, size) => n + size, 0) > LIMITS.bytes)
  throw new Error("Evidence exceeds the 256 KB limit.");
const sources = await Promise.all(
  files.map(async (name) => ({
    name: basename(name),
    text: await readFile(name, "utf8"),
    kind: /\.md$/i.test(name) ? ("runbook" as const) : ("log" as const),
  })),
);
const report = await investigate({ question, sources });
console.log(
  args.includes("--json")
    ? JSON.stringify(report, null, 2)
    : toMarkdown(report),
);
