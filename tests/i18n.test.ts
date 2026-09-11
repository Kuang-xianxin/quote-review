import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocale, translate } from "../core/i18n.ts";
import { localizeReport } from "../core/presentation.ts";
import { CASES, caseBundle } from "../core/fixtures.ts";
import { investigate, toMarkdown, buildPrompt } from "../core/engine.ts";

test("explicit language links override device preference, with supported fallbacks", () => {
  assert.equal(resolveLocale("?lang=en", "zh-CN", ["zh-CN"]), "en");
  assert.equal(resolveLocale("?lang=zh-CN", "en", ["en-US"]), "zh-CN");
  assert.equal(
    resolveLocale("?lang=unsupported", null, ["fr", "zh-TW"]),
    "zh-CN",
  );
  assert.equal(resolveLocale("", "en", ["zh-CN"]), "en");
  assert.equal(resolveLocale(), "en");
});

test("localized reports preserve evidence, citations, user text, digest, and generated claims", async () => {
  const report = await investigate(caseBundle(CASES[2]));
  report.ai = {
    model: "test",
    durationMs: 0,
    rejected: [],
    hypotheses: [
      {
        title: "Original model claim",
        explanation: "Unconfirmed",
        nextCheck: "Check trace",
        citations: [report.findings[0].citations[0]],
      },
    ],
  };
  const original = JSON.stringify(report);
  const chinese = localizeReport(report, "zh-CN");
  assert.equal(JSON.stringify(report), original);
  assert.deepEqual(chinese.evidence, report.evidence);
  assert.deepEqual(chinese.retrieved, report.retrieved);
  assert.deepEqual(chinese.ai?.hypotheses, report.ai.hypotheses);
  assert.equal(chinese.question, report.question);
  assert.equal(chinese.digest, report.digest);
  assert.match(
    chinese.findings.find((f) => f.category === "work-after-cancel")!.detail,
    /trace 为 run-119/,
  );
  for (let i = 0; i < report.findings.length; i++)
    assert.deepEqual(
      chinese.findings[i].citations,
      report.findings[i].citations,
    );
  assert.match(toMarkdown(report, "zh-CN"), /故障排查报告/);
  assert.match(toMarkdown(report, "en"), /investigation report/);
  assert.ok(
    toMarkdown(report, "zh-CN").includes(
      report.findings[0].citations[0].quote.replace(/[\\`*_{}[\]<>]/g, "\\$&"),
    ),
  );
});

test("Chinese sample bundles retain original runtime logs and diagnostic coverage", async () => {
  for (const sample of CASES) {
    const bundle = caseBundle(sample, "zh-CN");
    assert.equal(bundle.sources[0].text, sample.logs);
    assert.match(bundle.question, /[\u4e00-\u9fff]/);
    const report = await investigate(bundle);
    for (const category of sample.expected)
      assert.ok(
        report.findings.some((f) => f.category === category),
        category,
      );
    for (const finding of localizeReport(report, "zh-CN").findings) {
      assert.match(finding.title, /[\u4e00-\u9fff]/);
      assert.match(finding.nextCheck, /[\u4e00-\u9fff]/);
    }
  }
});

test("local model language instruction leaves selected evidence and quote contract intact", async () => {
  const report = await investigate(caseBundle(CASES[0]));
  const en = buildPrompt(report, "en"),
    cn = buildPrompt(report, "zh-CN");
  assert.match(cn.system, /Simplified Chinese/);
  assert.match(
    cn.system,
    /Keep JSON keys, evidenceId and quote in their exact original form/,
  );
  assert.equal(cn.user, en.user);
  assert.deepEqual(cn.evidence, en.evidence);
  assert.equal(
    translate("zh-CN", "Line 5 in <file>.log exceeds 2,000 characters."),
    "<file>.log 的第 5 行超过 2,000 个字符。",
  );
  assert.equal(
    translate("zh-CN", "Unknown runtime diagnostic"),
    "Unknown runtime diagnostic",
  );
});
