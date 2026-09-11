# Validation scope

This release is being validated against the actual local API, parser subprocess, owned CPU model and public deployment. See `validation/model-regression.json` for full synthetic inputs, expected fields, actual model output, timing and mismatches. The smaller baseline model's failures remain in `validation/baseline-qwen2.5-1.5b.json`.

The fixture corpus is small: bilingual samples, separate-product examples, independent MOQ units, ambiguous currency, an instruction-injection case, two-row CSV/XLSX and a text PDF. The first two examples informed prompt development; do not call them held-out. No real supplier data, adoption study or production-accuracy estimate is included.

API tests use real temporary SQLite and filesystem storage; only inference results are test doubles there. They verify private-session isolation, CSRF rejection, concurrent upload bounds/deduplication, exclusive claims, stale/cancelled completions, review conflicts and audit atomicity, deletion, expiry cleanup, decimal unit math and CSV safety. Parser tests cover text locations, tabular values, formulas, scans, oversized text and plain email.

Native model timing excludes startup/download and measures the benchmark's parse-and-extract interval. CPU host: Intel i5-12400, about 25 GB RAM, 4 inference threads, Windows. The pinned model is Qwen3-4B-Q4_K_M; no remote inference API is used.

No browser visual or interaction acceptance was performed. TypeScript/build and HTTP checks cannot prove every visual interaction. Public API verification is recorded separately once deployed. Known unsupported inputs include scanned PDFs, complex table layout and non-count price bases such as kg/metres.

## Local measurement, 2026-09-11

9 API/calculation tests and 4 parser tests pass; typecheck, lint and production build pass. All checked fields matched in the 8 normal quotation cases. The instruction-injection case still had one wrong price and triggers a document-instruction warning. These figures are not production accuracy.

| Case | Seconds | Field mismatches |
|---|---:|---:|
| sample-en | 42.1 | 0 |
| sample-zh | 27.9 | 0 |
| holdout-zh | 24.8 | 0 |
| independent-moq-unit | 28.9 | 0 |
| ambiguous-dollar | 22.8 | 0 |
| untrusted-instruction | 33.4 | 1 |
| table-csv | 51.7 | 0 |
| table-xlsx | 39.0 | 0 |
| text-pdf | 34.3 | 0 |

## Public API verification

2026-09-11: an anonymous session uploaded a Chinese TXT and text PDF through the public API. Cloud file storage, durable jobs and the actual local model completed extraction in 55.4 s and 38.7 s; checked fields matched. Saved reviews produced prices of 2.00 and 2.40 USD per each, two audit events and a Chinese CSV export. A request without the session returned 401 for the private project. The verification project/files were deleted. Published JS/CSS hashes matched the build. See `validation/public-deployment.json`.

The public compute worker currently runs in a task-managed session on the operator computer, not an installed boot service. Closing that session, sleep or network loss leaves new jobs queued. GitHub CI passed on Windows and Linux. No browser visual acceptance was performed.
