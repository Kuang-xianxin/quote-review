# Validation record and limits

Reference environment: Windows, Node.js 22.23.1, TypeScript 5.9.3. This record describes the v0.1 implementation, not a production service benchmark.

The reference run on 2026-09-10 passed 30 automated tests, all 14 deterministic fixture assertions, TypeScript checking, lint, and the production build. See GitHub Actions for independent CI results.

## Reproduce

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run eval
npm run build
npm run investigate -- samples/retry-storm.log samples/retry-storm.md --json
```

The test suite checks ingestion, redaction, source identity, runbook/log separation, lexical retrieval, unknown evidence, citation rejection, event correlation, digest stability, input limits, CLI parameters and worker lifecycle. The deterministic fixture evaluation has 14 explicit assertions over synthetic scenarios and negative cases.

Worker-lifecycle tests use a controllable worker substitute. They verify that completion, cancellation, malformed JSON and worker failure settle the correct Promise and terminate the owned worker. **They do not measure WebGPU execution, model quality, GPU memory reclamation, or browser download caching.**

The local-model adapter builds against the installed runtime and references a model in its catalog. A real end-to-end model download/inference run and cross-browser GPU validation have not been completed in this reference environment. Model output is therefore not presented as benchmarked. Unsupported hardware reports an error and preserves the deterministic analysis.

WebMCP adapters have unit-level schema/state-transition checks. Live registration in a browser implementing the experimental WebMCP API has not been verified. Ordinary application use does not depend on WebMCP support.

## Limits that matter

- Synthetic rule fixtures are not evidence of incident root-cause accuracy on production data.
- A valid citation verifies source identity and an exact quote, not entailment or truth.
- Retrieval is lexical BM25, not semantic embeddings. It can miss paraphrases.
- Source-type labels are supplied by the user; the app cannot independently authenticate a log's origin.
- Prompt-injection detection and credential redaction are incomplete pattern-based aids.
- Model context is bounded by selected lines/characters; unusual tokenization can still exceed the model's token window and fail cleanly.
- The small model may return no usable hypotheses. The evidence report remains useful and exportable.
- File input limits are meant for a focused incident window, not bulk telemetry ingestion.

Future model evaluations should record the exact model/runtime versions, hardware, prompt, inputs, generation settings, malformed-output rate, invalid-citation rate and human-labeled support/causality judgments. Do not collapse these into a single “accuracy” claim.
