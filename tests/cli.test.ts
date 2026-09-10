import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const cli = (args: string[]) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/investigate.ts", ...args],
    { encoding: "utf8" },
  );
test("CLI reads the first file when --question is omitted", () => {
  const r = cli(["samples/retry-storm.log", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.ok(
    report.findings.some(
      (f: { category: string }) => f.category === "rate-limit",
    ),
  );
});
test("CLI accepts an explicit question and runbook", () => {
  const r = cli([
    "samples/retry-storm.log",
    "samples/retry-storm.md",
    "--question",
    "Why did retries fail?",
    "--json",
  ]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.question, "Why did retries fail?");
  assert.ok(
    report.evidence.some((e: { kind: string }) => e.kind === "runbook"),
  );
});
test("CLI fails usefully on missing files", () => {
  const r = cli(["samples/nonexistent.log"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ENOENT/);
});
