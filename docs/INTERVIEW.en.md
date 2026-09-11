# Preparing for an AI application engineering interview

**English** · [简体中文](INTERVIEW.zh-CN.md) · [Project overview](../README.md)

## A one-minute introduction

“I built a free, open-source investigation workbench for AI application failures. It takes runtime logs and runbooks, establishes evidence with deterministic rules, retrieval and event correlation, and optionally runs a small open model in the visitor's browser to propose hypotheses. Each model citation must match source text. Cancelling a run terminates its owned Worker. The project has no paid API dependency, supports static hosting, and includes a CLI, reproducible evaluation, and Chinese and English interfaces.”

This describes the project's capabilities. The implementation was AI-assisted. Only claim personal understanding and verification after reading, running and testing it yourself. Do not invent customers, production traffic, team size, model accuracy or independently completed work.

## A five-minute demonstration

1. Open the workbench in English and choose **The task that stayed**. State that all sample logs are synthetic.
2. Click **Investigate**. Show a heartbeat for the same trace after cancellation. Inspect its timestamp, trace identifier and original line reference.
3. Change the later heartbeat's trace identifier and rerun. Explain why the engine should no longer establish continued activity for that same run.
4. Open **Run trace** and distinguish retrieval, rule analysis and citation verification. Explain that **Local AI** is a separate, optional generation step. Do not call rule output model output when no model was loaded.
5. Switch the interface language and show that evidence is unchanged. Export Markdown and JSON; explain source references and the SHA-256 fingerprint.

If the machine has no WebGPU support, explain that limitation and continue with deterministic analysis and code. Do not pretend to have run the model.

## Questions and reasoning

**Why not send the entire log to a model?**

Context budgets, privacy, noise and traceability all matter. Limit input, retain physical line numbers, mask likely secrets, distinguish runtime logs from reference material, then retrieve relevant evidence. BM25 is reproducible and needs no model download, but does not understand paraphrases. Do not describe it as vector or hybrid retrieval.

**How do you reject invented citations?**

The model sees selected evidence IDs and text. Its response must meet count and length limits. Each citation ID must belong to the supplied context, and its quote must be an exact substring. Quarantined instruction-like text cannot be cited. Invalid model output does not replace the completed evidence report.

**Does a matching citation establish a correct conclusion?**

No. It establishes that the quoted text exists. A model may use an irrelevant real quote to support a wrong inference. The UI therefore labels hypotheses as unconfirmed. A test deliberately preserves the “real quote, wrong causality” boundary. Measuring semantic support requires actual labeled data.

**Why is cancellation more than clearing a loading flag?**

Stopping a spinner does not stop computation. Each local-model attempt owns a dedicated Worker. Cancellation terminates it, rejects the pending Promise, clears its timer and retains the deterministic report. Late completion must also be ignored. Controllable Worker substitutes test this lifecycle; they do not validate real GPU inference.

**How do you evaluate the application?**

Start with observable synthetic scenarios and negative cases: retry storms, empty context and activity after cancellation. Test unknown or altered citations, instruction-like input, size limits, CLI parameters and cancellation races. Language tests verify that localization preserves evidence, quotes and digests. `npm run eval` tests deterministic behavior, not model accuracy or a production SLA.

**Why static hosting and local inference?**

The requirement is free open source without extra API costs. Computation and optional inference use the visitor's device, avoiding a hosted inference service. The tradeoffs are browser support, GPU memory, initial downloads and small-model quality. Enterprise authentication, telemetry ingestion, permissions and retention policies would require separate designs; this version does not implement them.

**What must stay unchanged when translating a report?**

Source names, physical line numbers, evidence IDs, exact quotes, user inputs and the integrity digest. Only application-owned narration is localized. Existing generated claims keep their actual language; a new run can request another language. Translation must not disguise changed evidence or a fresh inference.

## Exercises to complete personally

- Run `npm ci`, `npm test`, `npm run eval` and CLI examples in both languages.
- Locate source-type filtering, BM25, trace correlation, citation validation and digest computation in `core/engine.ts`.
- Add a failing fixture for one new failure mode, implement its rule, and add a negative case that must not match.
- Explain why propagating or shielding cancellation depends on task ownership.
- On supported hardware, run a real model and record the model, hardware, loading time, output and rejected citations. Do not present mock results or someone else's hardware results as your own verification.

## Resume boundaries

An accurate capability statement: “Built a local AI incident investigation tool with evidence retrieval, trace correlation, structured citation validation, cancellable model tasks, reproducible evaluation, a bilingual public demo and CLI.”

Avoid “production-grade autonomous operations platform,” “99% root-cause accuracy,” “zero hallucinations,” or “large-scale distributed agent system.” The implementation and evidence do not support those claims.
