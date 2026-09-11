<p align="center"><img src="public/favicon.svg" width="58" alt="Incident Weave" /></p>

**English** · [简体中文](README.zh-CN.md)
<h1 align="center">Incident Weave</h1>
<p align="center"><strong>Something broke. Follow the evidence.</strong><br/>Local-first investigation for AI application failures. No API keys. No subscriptions.</p>
<p align="center"><a href="https://incident-weave.loyal-lamb-5637.chatgpt.site">Try the workbench</a> · <a href="docs/INTERVIEW.en.md">Interview guide</a> · <a href="docs/ARCHITECTURE.md">Architecture</a> · <a href="docs/VALIDATION.md">Validation & limits</a></p>

An agent times out. Its background task is still running. A search tool returns HTTP 200 but no context. A retry loop ignores `Retry-After`. A generic explanation is easy; a defensible investigation needs the actual evidence.

Incident Weave turns logs and runbooks into **source-linked observations, inspectable evidence, and concrete next checks**. An optional open language model runs inside a dedicated browser worker and proposes tentative hypotheses. Every model citation is checked against the evidence it received.

## Try it in a minute

1. Open the [public workbench](https://incident-weave.loyal-lamb-5637.chatgpt.site).
2. Choose **The retry storm**, **The missing answer**, or **The task that stayed**.
3. Click **Investigate**. Inspect an `E0001` citation to see the exact source and line.
4. Export Markdown for an incident ticket, or JSON for further analysis.
5. Optionally open **Local AI** and download the model. This is an explicit, separate action.

The sample cases are synthetic and labeled as such. You can replace them with your own `.log`, `.txt`, `.md`, `.json`, `.jsonl`, or `.csv` files. JSON/CSV are treated as line-oriented text in v0.1, not parsed as a complete telemetry schema. Markdown files are reference material and cannot produce runtime observations.

## Chinese and English

Use **中文 / English** in the top bar, or open [Chinese](https://incident-weave.loyal-lamb-5637.chatgpt.site/?lang=zh-CN) / [English](https://incident-weave.loyal-lamb-5637.chatgpt.site/?lang=en) directly. Language selection prefers the URL, then a saved device preference, then a supported browser language, with English as the fallback.

The UI, app-owned report narration, Markdown/JSON exports and main documentation support both languages. Switching preserves the current question, evidence and report. Reselecting a sample loads its question and runbook in the current language; runtime logs stay verbatim. Source quotes, field names, identifiers, fingerprints and user inputs are never translated. Existing model claims keep their actual language. A new local-model run requests the current language, but the small model may not comply. Unknown runtime diagnostics retain their original technical text. Cross-language model quality has not been benchmarked.

## What is implemented

| Capability             | Behavior                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Evidence ingestion     | Up to 12 files, 256 KB, 2,500 lines; stable source and line references                                                       |
| Local redaction        | Best-effort credential and email masking before retrieval, inference, and export                                             |
| Retrieval              | BM25 with word/CJK-bigram tokenization and source diversity; no external index                                               |
| Diagnostics            | Rate limits, zero-delay retries, pool exhaustion, timeouts, cancellation, empty retrieval, parsing errors, upstream failures |
| Event correlation      | Reports activity after cancellation only with matching source, trace ID, and increasing ISO timestamp                        |
| Optional local AI      | WebGPU inference with an open 0.5B model in an owned Web Worker                                                              |
| Citation gate          | Rejects nonexistent IDs, altered quotes, malformed output and detected instruction-like evidence                             |
| Cancellation           | Terminates the run's worker; the completed evidence report is retained                                                       |
| Portable engine        | Same engine in browser, CLI, fixture evaluation and optional WebMCP tools                                                    |
| Export & local history | Markdown/JSON; opt-in browser storage for up to five redacted reports                                                        |

**Citation verification proves source/quote identity, not truth or causality.** Model suggestions remain unconfirmed even if all quotes match. The tool does not execute remediation, claim a confirmed root cause, or certify that a service is healthy.

## Run locally

Node.js 22.13+ and npm are required.

```sh
git clone https://github.com/Kuang-xianxin/incident-weave.git
cd incident-weave
npm ci
npm run dev
```

Open the local URL printed by Vite. No database, account, API key or environment secret is required.

```sh
npm test
npm run typecheck
npm run eval
npm run build
npm run start
```

`npm run build` produces a static `dist/` directory. Serve it over HTTPS or localhost. You can use any static host; a path prefix can be configured using `VITE_BASE_PATH=/incident-weave/` during the build. `.openai/hosting.json` identifies this project's hosted demo; replace its `project_id` when registering your own Sites project. It is not needed by a static host.

### Command-line investigation

```sh
npm run investigate -- samples/retry-storm.log samples/retry-storm.md
npm run investigate -- samples/retry-storm.log --lang zh-CN
npm run investigate -- samples/cancel-leak.log --question "What happened after cancellation?" --json
```

The CLI runs deterministic analysis only. Use `--lang en` (default) or `--lang zh-CN` for report narration. JSON includes a `language` field while machine-readable keys and evidence stay unchanged. It reads explicitly named files and makes no network requests. Local model inference is a browser feature in v0.1.

## Local AI: free, but not zero-resource

The optional model is `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`, loaded through WebLLM. It needs WebGPU, roughly 1.1 GB available GPU memory according to the runtime catalog, and an initial download of several hundred MB. Runtime/model files are downloaded from their public hosts; evidence is not submitted to them. Browser caching can reduce repeat downloads but is browser-controlled.

There is no per-request API charge. Inference uses the visitor's hardware, electricity, bandwidth and storage. Unsupported devices can still use all deterministic analysis and exports. A small model is a hypothesis generator, not an expert investigator. See the [runtime documentation](https://webllm.mlc.ai/docs/user/basic_usage.html) and [model catalog](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts).

## Engineering boundaries

- No paid API integration, evidence-upload endpoint, telemetry SDK or hosted model service.
- App/model asset requests still contact their hosts. Hosting providers may keep ordinary access logs.
- Evidence is untrusted input. Pattern-based quarantine/redaction is best effort, not a complete security boundary.
- No semantic entailment classifier: a quote can match while a hypothesis is wrong.
- No backend job persistence, arbitrary command execution, automatic remediation or live observability integration in v0.1.
- Built-in evaluation tests deterministic behavior and validation gates. It is **not a model accuracy benchmark**.

## Contribute

The best contributions are small, reproducible cases where the current engine reaches a misleading conclusion or misses a useful signal. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Keep private logs out of issues; provide synthetic reproductions. See [SECURITY.md](SECURITY.md) for privacy boundaries and security reporting.

MIT for original project code. Third-party UI/build sources retain their licenses; model/runtime licenses are separate. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
