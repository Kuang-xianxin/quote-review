import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { investigate, toMarkdown, LIMITS } from "../core/engine.ts";
import { localizeReport } from "../core/presentation.ts";
import type { Locale } from "../core/i18n.ts";
const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log(
    'Usage / 用法: npm run investigate -- <logs.txt> [runbook.md] [--question "Why did it fail?"] [--lang en|zh-CN] [--json]\nNo network requests or API keys. Input is capped at 256 KB.\n无需网络请求或 API 密钥。输入上限 256 KB。',
  );
  process.exit(args.includes("--help") ? 0 : 1);
}
const localeIndex = args.indexOf("--lang");
const localeValue = localeIndex === -1 ? "en" : args[localeIndex + 1];
if (localeValue !== "en" && localeValue !== "zh-CN")
  throw new Error("--lang requires en or zh-CN / --lang 必须为 en 或 zh-CN");
const locale: Locale = localeValue;
const questionIndex = args.indexOf("--question");
if (
  questionIndex !== -1 &&
  (!args[questionIndex + 1] || args[questionIndex + 1].startsWith("--"))
)
  throw new Error("--question requires a value");
const question =
  questionIndex === -1
    ? locale === "zh-CN"
      ? "发生了什么故障？下一步应该检查什么？"
      : "What failed, and what should I check next?"
    : args[questionIndex + 1];
const files = args.filter(
  (a, i) =>
    a !== "--json" &&
    a !== "--lang" &&
    (localeIndex === -1 || i !== localeIndex + 1) &&
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
    ? JSON.stringify(
        { ...localizeReport(report, locale), language: locale },
        null,
        2,
      )
    : toMarkdown(report, locale),
);
